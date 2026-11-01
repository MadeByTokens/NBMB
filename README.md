# Not Behind My Back (NBMB)

Check domain ideas with as few watchers as possible.

## Why this exists

There is a long-standing worry that a domain you search for could be spotted,
bought by someone else and resold to you at a profit. Nobody has shown how often
this happens, but the worry is reasonable, and a search should not hand your
idea to more parties than it must.

This project is not about hiding a purchase or making you anonymous. It has one
job: keep your ideas away from as many watchers as possible before you decide,
and be honest about the ones that remain.

We invite you to check this yourself. The code is short and has no dependencies,
and each result can show the exact requests your browser sent.

## What we did, and what we could not do

| Step we took | Risk it reduces | What remains |
|---|---|---|
| Ask the registry directly | Registrar and lookup sites logging your search | The registry always sees the name |
| Skip DNS checks by default | Resolvers and DNS monitors seeing the name | If you choose Check through Google DNS, Google and the TLD's servers see it |
| No backend, analytics or outside scripts | This site collecting your ideas | A hosted copy could be altered, so run it locally if unsure |
| Allow connections only to listed registries and Google DNS | The page sending your ideas elsewhere | Browser extensions can bypass this |
| Turn off spellcheck, translation and caching | Browser features sending or keeping the name | Browser vendors' own telemetry was not audited |
| Test each registry before sending your name | Sending your idea to a broken server | The test shows the registry that you looked at that ending |
| Name who saw each lookup | Trusting a party you did not know about | Our list of providers can go out of date |

Some registries sit behind Cloudflare, and some share an owner with a registrar.
We found no evidence of misuse, and we cannot rule it out. The evidence and
sources are in [docs/SAFETY.md](docs/SAFETY.md). If you find a mistake or a leak
we missed, please
[open an issue](https://github.com/MadeByTokens/NBMB/issues).

The strongest protection is simple: when you find a name you like, buy it soon.

## Run it

    python3 -m http.server 8000

Then open <http://localhost:8000>. Opening `index.html` directly from disk does
not work, because browsers block ES modules on `file://`.

This is a proof of concept. The public copy runs on GitHub Pages, deployed from
the root of `main`. Read [docs/SAFETY.md](docs/SAFETY.md) before hosting your own
copy, because it covers registry terms and what a host can see.

## When the page cannot reach a registry

Some endings, such as `.de` and `.co`, cannot be checked from a browser. For
these, and for any other Unknown result, the page offers a Check through Google
DNS button. Nothing goes to Google unless you press it.

| Check | Who can read the name | Encrypted on your network |
|---|---|---|
| Registry lookup | The registry, and Cloudflare for some registries | Yes |
| Check through Google DNS | Google, then the TLD's servers without your IP address | Yes |

DNS answers less than RDAP. A registered name with no nameservers looks the same
as a free one, so the result is "No delegation found". Trust "Registered", and
treat everything else as a hint.

## How a result is decided

This section describes the page. Each run starts with a test lookup of a
known-registered name in the same TLD.
If that fails, your name is not sent.

| Result | Meaning |
|---|---|
| Registered | The registry returned a record for exactly that name |
| No record found | The registry returned 404 and passed the test lookup. The name may be free, but reserved and premium names look the same |
| No delegation found | You chose Google DNS, and it found no nameservers. The name may be free, but registered names without nameservers look the same |
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
| `fonts/` | Bricolage Grotesque, served from this repo, with its licence |
| `data.js` | Generated snapshot of the IANA RDAP list |
| `tools/update_bootstrap.py` | Regenerates `data.js` and the CSP |
| `docs/SAFETY.md` | Safety investigation and known risks |

## Develop

    node --test                        # logic tests
    python3 tools/update_bootstrap.py  # refresh data.js and the CSP

Refresh the snapshot periodically. A stale list fails safe: a moved server shows
Unknown. `update_bootstrap.py` finds GoDaddy hosts itself, but the other host notes in
`lib.js` were measured by hand, so re-check them after a refresh.

## Rules for contributors

- Never add `rdap.org` or any aggregator as a fallback. `rdap.org` returned 404
  for registered domains.
- Never add analytics, external fonts, CDNs or a backend that sees names.
- Render registry data with `textContent` only.
- Keep lookups sequential and human-scale. Do not add bulk or scheduled checks,
  because registry terms ban high-volume automated use.
- When a server is added, confirm it returns 200 for a registered name.

## Similar projects

If you need bulk checks, prices or a name generator, try
[Domain Hunter](https://github.com/WhiteBite/Domain-Hunter), an MIT-licensed
browser app with more features and wider coverage. It makes a different trade:
it sends promising names to DNS providers to improve accuracy, and keeps a local
history. This project does less so that fewer parties see each name.

## Known limits

- `.de` has no CORS header and `.co` has no working RDAP server, so both show
  Unknown until you choose the Google DNS check.
- GoDaddy's servers (204 TLDs, including `.tv`, `.biz` and `.design`) work, but
  throttle quickly. A throttled IP address sees Unknown until the limit clears.
- `.io` and `.me` use a server that is not in the IANA list, which could change.
- `.org` may return 404 for some registered domains, according to Domain
  Hunter's source. We have not reproduced this.
- ccTLDs without an explicit test name use `nic.<tld>`. Where that does not
  exist, they show Unknown.

## Licence

[MIT](LICENSE)
