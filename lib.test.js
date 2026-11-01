import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildServerMap, canaryFor, classify, domainUrl, eventDate, normalizeName, parseNames, witnessesOf,
} from './lib.js';

const record = (ldhName) => ({ objectClassName: 'domain', ldhName });

test('a 404 proves nothing unless the server passed its canary', () => {
  assert.equal(classify({ status: 404, name: 'a.com', serverTrusted: true }), 'no-record');
  assert.equal(classify({ status: 404, name: 'a.com', serverTrusted: false }), 'unknown');
});

test('failures and throttling never read as no record', () => {
  for (const status of [0, 301, 403, 429, 500]) {
    assert.equal(classify({ status, name: 'a.com', serverTrusted: true }), 'unknown');
  }
});

test('a 200 must describe the requested domain', () => {
  const base = { status: 200, name: 'a.com', serverTrusted: true };
  assert.equal(classify({ ...base, body: record('A.COM') }), 'registered');
  assert.equal(classify({ ...base, body: record('b.com') }), 'unknown');
  assert.equal(classify({ ...base, body: { errorCode: 200 } }), 'unknown');
  assert.equal(classify({ ...base, body: null }), 'unknown');
});

test('normalizes names', () => {
  assert.deepEqual(normalizeName(' Example.COM. '), { name: 'example.com' });
  assert.deepEqual(normalizeName('https://example.com/path?q=1'), { name: 'example.com' });
  assert.deepEqual(normalizeName('café.com'), { name: 'xn--caf-dma.com' });
  assert.deepEqual(normalizeName('shop.co.uk'), { name: 'shop.co.uk' });
});

test('rejects input that would give a misleading answer', () => {
  for (const bad of ['acme', 'www.example.com', 'a.b.c.d', '-bad.com', 'a b', 'user@x.com:80']) {
    assert.ok(normalizeName(bad).error, bad);
  }
});

test('parseNames splits and removes duplicates', () => {
  const names = parseNames('a.com, b.dev\na.com;A.com').map((e) => e.name);
  assert.deepEqual(names, ['a.com', 'b.dev']);
});

test('server map applies overrides and fixes trailing slashes', () => {
  const map = buildServerMap({
    services: [[['COM'], ['http://x.test/', 'https://x.test/v1']], [['net'], ['http://only.test/']]],
  });
  assert.equal(map.get('com'), 'https://x.test/v1/');
  assert.equal(map.has('net'), false);
  assert.ok(map.get('io').includes('identitydigital'));
  assert.equal(domainUrl(map.get('com'), 'a.com'), 'https://x.test/v1/domain/a.com');
});

test('canaries', () => {
  assert.equal(canaryFor('io'), 'github.io');
  assert.equal(canaryFor('dev'), 'nic.dev');
});

test('witnesses include network providers and registrar ties', () => {
  assert.deepEqual(witnessesOf('https://rdap.verisign.com/com/v1/'), { names: 'Verisign', registrarWarning: '' });
  assert.deepEqual(witnessesOf('https://rdap.identitydigital.services/rdap/'), {
    names: 'Identity Digital and Cloudflare',
    registrarWarning: 'Identity Digital also owns a registrar.',
  });
  assert.equal(witnessesOf('https://rdap.other.test/').names, 'rdap.other.test');
  assert.deepEqual(witnessesOf('https://rdap.nic.tv/', new Set(['rdap.nic.tv'])), {
    names: 'GoDaddy',
    registrarWarning: 'GoDaddy also owns a registrar.',
  });
});

test('malformed registry dates do not throw', () => {
  for (const events of ['x', [null], [{ eventAction: 'registration', eventDate: 5 }]]) {
    assert.equal(eventDate({ events }, 'registration'), null);
  }
  const events = [{ eventAction: 'registration', eventDate: '2001-01-13T00:00:00Z' }];
  assert.equal(eventDate({ events }, 'registration'), '2001-01-13');
});
