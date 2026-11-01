# Sealed domain check

A static page that checks whether domains have a registration record by asking
each registry directly over RDAP. It keeps your exploratory searches out of
registrar search boxes. It has no backend, no dependencies and no build step.

This is a proof of concept. It reduces exposure but does not make a search
invisible. Read [docs/SAFETY.md](docs/SAFETY.md) before hosting it for others.

## Run it

    python3 -m http.server 8000

Then open <http://localhost:8000>. Opening `index.html` directly from disk does
not work, because browsers block ES modules on `file://`. Any static host works.

## How a result is decided

Each run starts with a test lookup of a known-registered name in the same TLD.
If that fails, your name is not sent.

| Result | Meaning |
|---|---|
| Registered | The registry returned a record for exactly that name |
| No record found | The registry returned 404 and passed the test lookup. The name may be free, but reserved and premium names look the same |
| Unknown | Throttling, a blocked request, a redirect, an unclear answer, or a TLD with no usable server |
| Not checked | The input was not a registrable domain, so nothing was sent |

Registries do not treat RDAP as authoritative for availability. Only a registrar
can confirm that a name can be bought, and at what price.

## Project layout

| Path | Purpose |
|---|---|
| `index.html`, `style.css` | The page, including the generated CSP |
| `app.js` | Network requests and rendering |
| `lib.js` | Pure logic: parsing, server choice, classification |
| `lib.test.js` | Tests for `lib.js` |
| `data.js` | Generated snapshot of the IANA RDAP list |
| `tools/update_bootstrap.py` | Regenerates `data.js` and the CSP |
| `docs/SAFETY.md` | Safety investigation and known risks |

## Develop

    node --test                        # logic tests
    python3 tools/update_bootstrap.py  # refresh data.js and the CSP

Refresh the snapshot periodically. A stale list fails safe: a moved server shows
Unknown. The script finds GoDaddy hosts itself, but the other host notes in
`lib.js` were measured by hand, so re-check them after a refresh.

## Rules for contributors

- Never add `rdap.org` or any aggregator as a fallback. `rdap.org` returned 404
  for registered domains.
- Never add analytics, external fonts, CDNs or a backend that sees names.
- Render registry data with `textContent` only.
- Keep lookups sequential and human-scale. Do not add bulk or scheduled checks,
  because registry terms ban high-volume automated use.
- When a server is added, confirm it returns 200 for a registered name.

## Known limits

- `.de` has no CORS header and `.co` has no working RDAP server, so both show
  Unknown.
- GoDaddy's servers (204 TLDs, including `.tv`, `.biz` and `.design`) work, but
  throttle quickly. A throttled IP address sees Unknown until the limit clears.
- `.io` and `.me` use a server that is not in the IANA list, which could change.
- ccTLDs without an explicit test name use `nic.<tld>`. Where that does not
  exist, they show Unknown.
