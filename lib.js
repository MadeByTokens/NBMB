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

// Measured 2026-11-01; see docs/SAFETY.md. `via` can read lookups because it
// terminates TLS. `registrar` means the same owner also sells domains.
const OPERATORS = {
  'rdap.verisign.com': { name: 'Verisign' },
  'tld-rdap.verisign.com': { name: 'Verisign' },
  'rdap.identitydigital.services': { name: 'Identity Digital', via: 'Cloudflare', registrar: true },
  'pubapi.registry.google': { name: 'Google Registry' },
  'rdap.publicinterestregistry.org': { name: 'Public Interest Registry', via: 'Cloudflare' },
  'rdap.gmoregistry.net': { name: 'GMO Registry', via: 'Cloudflare' },
  'rdap.cctld.au': { name: 'the .au registry', via: 'Cloudflare' },
  'rdap.nic.gov': { name: 'the .gov registry', via: 'Cloudflare' },
  'rdap.nominet.uk': { name: 'Nominet' },
  'rdap.centralnic.com': { name: 'CentralNic', registrar: true },
  'rdap.centralnicregistry.com': { name: 'CentralNic', registrar: true },
  'rdap.registro.br': { name: 'Registro.br' },
};

const GODADDY = { name: 'GoDaddy', registrar: true };

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

// Plain words for the "what was sent" list under each result.
export function statusText(status, validRecord = true) {
  if (status === 200) return validRecord ? 'record found' : 'unexpected answer';
  if (status === 404) return 'no record';
  if (status === 0) return 'no readable answer';
  return `answered ${status}`;
}

export const domainUrl = (server, name) => `${server}domain/${encodeURIComponent(name)}`;
export const canaryFor = (tld) => CANARIES[tld] ?? `nic.${tld}`;

// Everyone known to see a lookup sent to this server, as a phrase for the page.
export function witnessesOf(serverUrl, godaddyHosts = new Set()) {
  const host = new URL(serverUrl).hostname;
  const operator = OPERATORS[host] ?? (godaddyHosts.has(host) ? GODADDY : { name: host });
  const names = operator.via ? `${operator.name} and ${operator.via}` : operator.name;
  return { names, registrarWarning: operator.registrar ? `${operator.name} also owns a registrar.` : '' };
}

// True only for a well-formed record of this exact domain.
export function isRecordOf(body, name) {
  return body?.objectClassName === 'domain'
    && typeof body.ldhName === 'string'
    && body.ldhName.toLowerCase().replace(/\.$/, '') === name;
}

// Decides what a response shows. A 404 means only "no record found": reserved
// and premium names also return 404, so it never proves a name can be bought.
export function classify({ status, body, name, serverTrusted }) {
  if (status === 200) {
    return isRecordOf(body, name) ? 'registered' : 'unknown';
  }
  if (status === 404 && serverTrusted) return 'no-record';
  return 'unknown';
}

// Registry data is untrusted, so a malformed record yields null, not an exception.
export function eventDate(body, action) {
  if (!Array.isArray(body?.events)) return null;
  const event = body.events.find((e) => e?.eventAction === action);
  const date = event?.eventDate;
  return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date) ? date.slice(0, 10) : null;
}
