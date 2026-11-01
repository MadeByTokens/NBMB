// Pure logic: no network or DOM, so it can be tested under Node.

export const MAX_NAMES = 20;

// Absent from the IANA list, but answered by this server. Verified 2026-11-01.
const SERVER_OVERRIDES = {
  io: 'https://rdap.identitydigital.services/rdap/',
  me: 'https://rdap.identitydigital.services/rdap/',
};

// A 404 only means something if this server knows registered names. Each TLD
// gets a canary; nic.<tld> is required for gTLDs, ccTLDs need an explicit one.
const CANARIES = {
  ai: 'google.ai',
  br: 'registro.br',
  io: 'github.io',
  me: 'about.me',
  uk: 'bbc.co.uk',
};

// Names under these suffixes are registrable at the third level.
const SECOND_LEVEL_SUFFIXES = new Set([
  'co.uk', 'org.uk', 'me.uk', 'com.br', 'net.br', 'org.br',
  'com.au', 'net.au', 'org.au',
]);

const OPERATORS = {
  'rdap.verisign.com': 'Verisign',
  'tld-rdap.verisign.com': 'Verisign',
  'rdap.identitydigital.services': 'Identity Digital',
  'pubapi.registry.google': 'Google Registry',
  'rdap.publicinterestregistry.org': 'Public Interest Registry',
  'rdap.nominet.uk': 'Nominet',
  'rdap.centralnic.com': 'CentralNic',
  'rdap.registro.br': 'Registro.br',
};

const LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;

// Returns {name} in ASCII form, or {input, error} with a fixable message.
export function normalizeName(raw) {
  const cleaned = raw.trim().replace(/^https?:\/\//i, '').replace(/[/?#].*$/, '').replace(/\.$/, '');
  // The URL parser would drop these parts and check a different name.
  if (/[@:\\]/.test(cleaned)) {
    return { input: raw, error: 'Enter a domain only, such as example.com.' };
  }
  let host;
  try {
    host = new URL(`http://${cleaned}`).hostname; // applies IDNA (café -> xn--caf-dma)
  } catch {
    return { input: raw, error: 'This is not a valid domain name.' };
  }
  const labels = host.split('.');
  if (labels.length < 2 || !labels.every((l) => LABEL.test(l))) {
    return { input: raw, error: 'Enter a full domain, such as example.com.' };
  }
  const registrable = labels.length === 2
    || (labels.length === 3 && SECOND_LEVEL_SUFFIXES.has(labels.slice(1).join('.')));
  if (!registrable) {
    // Registries answer 404 for subdomains, which would read as "not registered".
    return { input: raw, error: 'Enter the domain itself, without a subdomain.' };
  }
  return { name: host };
}

export function parseNames(text) {
  const seen = new Set();
  const out = [];
  for (const part of text.split(/[\s,;]+/).filter(Boolean)) {
    const parsed = normalizeName(part);
    const key = parsed.name ?? parsed.input;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(parsed);
    }
  }
  return out;
}

export const tldOf = (name) => name.slice(name.lastIndexOf('.') + 1);

export function buildServerMap(bootstrap) {
  const map = new Map();
  for (const [tlds, urls] of bootstrap.services) {
    const url = urls.find((u) => u.startsWith('https://'));
    if (!url) continue;
    for (const tld of tlds) map.set(tld.toLowerCase(), url.endsWith('/') ? url : `${url}/`);
  }
  for (const [tld, url] of Object.entries(SERVER_OVERRIDES)) map.set(tld, url);
  return map;
}

export const domainUrl = (server, name) => `${server}domain/${encodeURIComponent(name)}`;
export const canaryFor = (tld) => CANARIES[tld] ?? `nic.${tld}`;

export function operatorOf(serverUrl) {
  const host = new URL(serverUrl).hostname;
  return OPERATORS[host] ?? host;
}

// True only for a well-formed record of this exact domain.
export function isRecordOf(body, name) {
  return body?.objectClassName === 'domain'
    && typeof body.ldhName === 'string'
    && body.ldhName.toLowerCase().replace(/\.$/, '') === name;
}

// Decides what a response proves. Anything short of proof is "unknown",
// so a broken or throttled server can never produce "not registered".
export function classify({ status, body, name, serverTrusted }) {
  if (status === 200) {
    return isRecordOf(body, name) ? 'registered' : 'unknown';
  }
  if (status === 404 && serverTrusted) return 'not-registered';
  return 'unknown';
}

export function eventDate(body, action) {
  const event = body?.events?.find((e) => e.eventAction === action);
  return event?.eventDate?.slice(0, 10) ?? null;
}
