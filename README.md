# Sealed domain check

A static page that checks whether domains are registered by asking each
registry directly over RDAP, so a registrar never sees your exploratory
searches. There is no backend, no dependency and no build step.

## Run it

    python3 -m http.server 8000

Then open <http://localhost:8000>. Opening `index.html` directly from disk does
not work, because browsers block ES modules on `file://`. Any static host works.

## Develop

    node --test                        # logic tests
    python3 tools/update_bootstrap.py  # refresh data.js and the CSP

## How a result is decided

- **Registered**: the registry returned a record for exactly that name.
- **Not registered**: the registry returned 404 and first returned a valid
  record for a known-registered name in the same TLD. Reserved and premium names
  can still land here, so a registrar has the final word.
- **Unknown**: anything else, including throttling, blocked requests and TLDs
  with no usable server. A failure can never read as "not registered".

## Limits

- No lookup is invisible: the registry sees the name and your IP address.
- Some TLDs cannot be checked from a browser, such as `.de` (no CORS header) and
  `.co` (no working RDAP server found).
- `.io` and `.me` use a server missing from the IANA list, which could change.
- Don't add `rdap.org` as a fallback. It returned 404 for registered domains.
