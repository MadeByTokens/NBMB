import { BOOTSTRAP } from './data.js';
import {
  MAX_NAMES, buildServerMap, canaryFor, classify, domainUrl, eventDate,
  isRecordOf, parseNames, statusText, tldOf, witnessesOf,
} from './lib.js';

const TIMEOUT_MS = 10000;
const GAP_MS = 300; // registries throttle quickly, so queries never overlap
const RETRY_DELAY_MS = 1500;
const NOT_SENT = 'Your name was not sent.';

const form = document.querySelector('#search');
const input = document.querySelector('#names');
const button = form.querySelector('button');
const formError = document.querySelector('#form-error');
const results = document.querySelector('#results');
const summary = document.querySelector('#summary');
const rowTemplate = document.querySelector('#row');
document.querySelector('#snapshot').textContent = BOOTSTRAP.publication.slice(0, 10);

const servers = buildServerMap(BOOTSTRAP);
const godaddyHosts = new Set(BOOTSTRAP.godaddyHosts);
const canaryResults = new Map(); // tld -> Promise<{ok, url, status}>, cleared on each run

const STATE_TEXT = {
  waiting: 'Waiting',
  checking: 'Checking',
  registered: 'Registered',
  'no-record': 'No record found',
  unknown: 'Unknown',
  invalid: 'Not checked',
};

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

async function requestOnce(url) {
  const response = await fetch(url, {
    headers: { Accept: 'application/rdap+json' },
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    cache: 'no-store',
    redirect: 'error', // the canary vouches for this server, not for another one
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = await response.json().catch(() => null);
  return { status: response.status, body };
}

// Returns the last answer plus the status of every attempt, so the page can
// list each request. Status 0 means no readable answer: blocked or down.
async function request(url) {
  const attempts = [];
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt > 0) await sleep(RETRY_DELAY_MS);
    try {
      const result = await requestOnce(url);
      attempts.push(result.status);
      if (result.status !== 429) return { ...result, attempts };
    } catch {
      attempts.push(0);
    }
  }
  return { status: attempts.at(-1), body: null, attempts };
}

function runCanary(tld, server) {
  if (!canaryResults.has(tld)) {
    const canary = canaryFor(tld);
    const url = domainUrl(server, canary);
    canaryResults.set(tld, request(url).then(({ status, body, attempts }) => ({
      ok: status === 200 && isRecordOf(body, canary),
      url,
      attempts,
    })));
  }
  return canaryResults.get(tld);
}

function createRow(entry) {
  const row = rowTemplate.content.firstElementChild.cloneNode(true);
  row.querySelector('.name').textContent = entry.name ?? entry.input;
  results.append(row);
  return row;
}

function setRow(row, state, detail, seenBy) {
  row.dataset.state = state;
  row.querySelector('.state').textContent = STATE_TEXT[state];
  row.querySelector('.detail').textContent = detail ?? '';
  row.querySelector('.seen').textContent = seenBy ?? '';
}

function addTrailLine(row, text) {
  const item = document.createElement('li');
  item.textContent = text;
  row.querySelector('.trail ol').append(item);
  row.querySelector('.trail').hidden = false;
}

// Lists every request behind a result, so users can verify them.
function addTrail(row, label, url, attempts, validRecord) {
  for (const status of attempts) {
    addTrailLine(row, `${label}: ${url} (${statusText(status, validRecord)})`);
  }
}

function registeredDetail(body) {
  const created = eventDate(body, 'registration');
  const expires = eventDate(body, 'expiration');
  const parts = [];
  if (created) parts.push(`Registered ${created}.`);
  if (expires) parts.push(`Expires ${expires}.`);
  return parts.join(' ');
}

async function check(name, row) {
  const tld = tldOf(name);
  const server = servers.get(tld);
  if (!server) {
    setRow(row, 'unknown', `.${tld} has no public lookup this page can use. Check it at your registrar when you are ready to buy.`, NOT_SENT);
    return;
  }

  setRow(row, 'checking');
  const { names, registrarWarning } = witnessesOf(server, godaddyHosts);

  // The test lookup comes first, so your name is not sent to a server
  // whose answer could not be trusted anyway.
  const reused = canaryResults.has(tld);
  const canary = await runCanary(tld, server);
  if (reused) addTrailLine(row, `Test lookup: reused the earlier .${tld} test`);
  else addTrail(row, 'Test lookup', canary.url, canary.attempts, canary.ok);
  if (!canary.ok) {
    setRow(row, 'unknown', `The .${tld} registry failed a test lookup. It may be blocking browsers or limiting requests. Try again in a minute.`, NOT_SENT);
    return;
  }

  await sleep(GAP_MS);
  const url = domainUrl(server, name);
  const { status, body, attempts } = await request(url);
  addTrail(row, 'Your name', url, attempts, isRecordOf(body, name));
  const state = classify({ status, body, name, serverTrusted: true });
  const seenBy = `Seen by ${names}. ${registrarWarning}`.trim();

  if (state === 'registered') {
    setRow(row, state, registeredDetail(body), seenBy);
  } else if (state === 'no-record') {
    setRow(row, state, 'This name may be free, but reserved and premium names look the same here. Your registrar has the final word.', seenBy);
  } else {
    setRow(row, state, 'The registry gave no clear answer. Try again in a minute.', `Possibly seen by ${names}. ${registrarWarning}`.trim());
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  formError.textContent = '';
  const entries = parseNames(input.value);

  if (entries.length === 0) {
    formError.textContent = 'Enter at least one domain, such as example.com.';
    return;
  }
  if (entries.length > MAX_NAMES) {
    formError.textContent = `Enter ${MAX_NAMES} domains or fewer. Registries limit how fast they answer.`;
    return;
  }

  button.disabled = true;
  canaryResults.clear();
  results.replaceChildren();
  summary.hidden = false;
  const rows = entries.map((entry) => [entry, createRow(entry)]);
  rows.forEach(([entry, row]) => {
    if (entry.error) setRow(row, 'invalid', entry.error, NOT_SENT);
    else setRow(row, 'waiting');
  });

  try {
    for (const [entry, row] of rows) {
      if (!entry.error) {
        try {
          await check(entry.name, row);
        } catch {
          setRow(row, 'unknown', 'This page could not read the answer. Try again in a minute.', '');
        }
        await sleep(GAP_MS);
      }
    }
  } finally {
    button.disabled = false;
  }
});
