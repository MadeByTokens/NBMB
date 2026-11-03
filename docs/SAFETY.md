# Safety investigation

Conducted 2026-11-01. Host and registry facts change, so re-check them before
relying on them. This is an engineering review, not legal advice.

## Summary

The goal is narrow: reduce the chance that someone sees a domain idea during a
search, buys it first and resells it at a profit. Hiding a purchase or making
users anonymous is out of scope.

The page reduces that risk but cannot remove it, because the registry must see
the name to answer. The main remaining risk is overtrust, so the page shows who
saw each lookup and the exact requests sent. No check found a way for names to reach anyone beyond the parties below,
given an unmodified page and a browser without hostile extensions.

## Who can see a lookup

| Party | Sees | Notes |
|---|---|---|
| Registry | Name, IP address, site origin, time | Unavoidable. Google's terms say it may retain query details |
| Cloudflare, for some registries | Same as the registry | Terminates TLS for 5 of 377 hosts, covering 509 of 1,203 listed TLDs |
| Imperva or Amazon CloudFront, for a few registries | Same as the registry | Imperva fronts `.sg`, its two IDN endings, `.brussels` and `.vlaanderen`; CloudFront fronts `.aquarelle` |
| Google, only if you press Check through Google DNS | Name, IP address, time | Passes the name to the TLD's servers without your IP address |
| Internet provider | Which registry host you contacted | Not the name. The host often reveals the TLD |
| Site host | That the page loaded | Could see names only by serving altered code |
| Browser extensions | Everything on the page | Use a private window with extensions off |
| Registrars | Nothing, unless they share an owner with the registry | See below |

Cloudflare-fronted hosts found by DNS: `rdap.identitydigital.services`,
`rdap.publicinterestregistry.org`, `rdap.gmoregistry.net`, `rdap.cctld.au` and
`rdap.nic.gov`. This covers `.org`, `.ai`, `.io` and `.me`. Detection used DNS
names and known Cloudflare IP ranges, so it can miss other CDNs and hosts.

A second scan on 2026-11-02 looked up the network owner of every host. It found
Imperva (Incapsula) in front of `rdap.sgnic.sg`, `rdap.ta.sgnic.sg`,
`rdap.zh.sgnic.sg`, `rdap.nic.brussels` and `rdap.nic.vlaanderen`, and Amazon
CloudFront in front of `rdap.nic.aquarelle`. The other 232 Amazon-hosted
servers showed no CloudFront headers, so they look like plain hosting. Imperva
also sets tracking cookies; the page sends requests without credentials, so the
browser neither stores nor returns them.

## The Google DNS check

Some endings cannot be reached from a browser, so the page offers a DNS check
for any Unknown result. It changes who can see a name, so it runs only when you
press its button.

| Check | Resolver | Your network | TLD servers |
|---|---|---|---|
| Registry lookup (RDAP) | None | Sees only the registry host | Registry sees name and IP address |
| Check through Google DNS | Sees name and IP address | Sees only `dns.google` | See the name, usually not your IP address |

- TLD servers generally do not offer encrypted DNS, so encryption needs a
  resolver in the middle. Google's request to the TLD's servers is not encrypted.
- Google sold its registrar business to Squarespace in 2023, so it no longer
  sells domains directly, but it still runs a registry for endings such as
  `.app` and `.dev`.
- Google keeps your IP address and query for 24 to 48 hours. It also keeps a
  permanent sample of queries, which includes the domain but not your IP address.
  We cannot verify either statement.
- Google normally passes part of your IP address to the servers it asks. The
  page asks it not to. We cannot verify that it complies.
- The page sends a random test name first. If that name appears to exist, as it
  does for `.ws`, the real name is not sent.
- The name is sent in a GET URL, because Google refuses the browser pre-check
  for POST. It is encrypted in transit and stays out of browser history.

## Registry and registrar ties

Registries are not always separate from registrars:

- Identity Digital (`.ai`, `.io`, `.me` and hundreds more) owns the registrar
  Name.com.
- GoDaddy runs both a registry and a large registrar. 204 listed hosts resolve
  to its infrastructure, including `.tv`, `.biz` and `.club`. Results name it.
- CentralNic (`.xyz` and others) belongs to Team Internet, which has registrar
  businesses.

ICANN's Registry Operator Code of Conduct limits some data sharing between a
registry and its affiliated registrars, but we could not confirm that it covers
lookup logs. We found no evidence that any of these companies misuses lookups.
The page names these ties so that users can decide for themselves.

## Front-running evidence

ICANN's 2008 review of about 120 complaints found too little evidence to conclude
that front-running happens at any appreciable scale, without ruling it out. The
closest confirmed conduct was Network Solutions locking searched names for five
days in 2008. We found no newer measurement. Treat the threat as plausible and
unquantified.

## Wrong results

Tested with real names:

| Case | Result |
|---|---|
| `co.uk`, `com.br`, `com.ai`, `com.fr` | Return 200, so they read as Registered |
| `example.dev`, `test.dev`, `a.dev`, `www.dev` | Return 404, although names like these may be reserved |
| `rdap.org` as a source | Returned 404 for `github.io`, `google.de`, `google.co` |

Domain Hunter's source says `.org` can return 404 for a domain that is registered
and live. We have not reproduced this. Confirming through DNS would expose the
name to more parties, so this project does not do it.

A false "no record" costs little, because the registrar check shows the truth.
That is why the label is "No record found", not "Available".

## Registry terms

We read the terms of Verisign, Public Interest Registry, Google Registry,
Identity Digital, CentralNic and Nominet in full, and the short notice from
Registro.br.

- All except Registro.br's notice ban high-volume automated querying. Verisign,
  Public Interest Registry and Identity Digital except what is reasonably
  necessary to register domains.
- A person checking a few names fits the query-based use these services describe.
  This page stays within that: 20 names per run, one request at a time, nothing
  stored.
- CentralNic limits use to determining ownership, and bans storing data. It
  threatens permanent blocking for abuse.
- Nominet describes its service as a way to look up existing domains, and Google
  describes its RDAP as an experimental pilot it can end at any time.
- Public Interest Registry and Identity Digital say RDAP is not authoritative
  and not a replacement for EPP.

Risk to users: repeated use from one IP address can get that address throttled.
This happened during testing: a sweep of all servers got one IP address blocked
by GoDaddy for at least 25 minutes, across every GoDaddy TLD. A second sweep on
2026-11-02 was cut off after about 100 queries, even with 3 seconds between
them, and the block was still in place an hour later (slow retests during that
hour may have extended it). During a block, results show Unknown, and the page
does not expose the reason.
Risk to anyone hosting a public copy: review these terms first, and keep the
page free of bulk features. Do not republish lookup results.

## Issues fixed in this review

| Issue | Fix |
|---|---|
| Headline implied that no registrar could learn of a search | Reworded, and registrar ties are now named |
| "Seen by" left out Cloudflare | Results name it where known |
| "Not registered" overstated a 404 | Now "No record found", with a caveat |
| A redirect could reach a server that had not passed the test lookup | Redirects now read as Unknown |
| One failed test lookup blocked a TLD until reload | Test lookups rerun on each check |
| A malformed registry date could freeze the page | Dates are validated, and each lookup is isolated |
| Users could not verify what was sent | Each result lists its exact requests |
| "Seen by nobody" was untrue after a test lookup | Now "Your name was not sent" |
| Browser translation could send names to a translation service | Translation is disabled for the page |
| Nine endings, `.ca` among them, always showed Unknown because `nic.<tld>` is not registered there, so the test lookup failed | Each now has a known registered test name; `.xihuan` and `.சிங்கப்பூர்` still have none |
| `example.co.th`, `example.co.kr` and `example.com.fj` were rejected as subdomains | Common third-level suffixes for `.th`, `.kr` and `.fj` are accepted |
| The update script could leave the CSP and data out of sync | It now fails if the CSP block is missing |
| Page omitted the trademark, price and rate limit risks | "When you find a name you like" section added |

## What was already sound

- Registry data is rendered only with `textContent`.
- The CSP allows only the page's own scripts and font, listed registry hosts and `dns.google`.
- Spellcheck and autocomplete are off, and the field has no form `name`.
- Fetches send no cookies or referrer, and bypass the HTTP cache.
- Names never appear in the page's own URL, storage or history.

## Remaining risks

- GitHub Pages cannot send `frame-ancestors`, so `app.js` refuses to run inside
  a frame instead. This is weaker than a header, but the page has no logins or
  actions worth hijacking. Hosts that can set headers should send it as well.
- GitHub can see each page load and the visitor's IP address, as any host can.
  Registries see the `github.io` origin, not a visitor's identity.
- A compromised host or repository could serve altered code. Running locally
  from a reviewed commit avoids this. `.nojekyll` makes Pages serve files
  unprocessed.
- The Cloudflare and registrar notes are hand-measured and can go stale.
- Browser vendors' own telemetry and extensions are outside the page's control,
  and were not audited.

## Sources

- [ICANN SAC024](https://new.icann.org/committees/security/sac024.pdf)
- [ICANN SAC022](https://www.icann.org/resources/pages/sac-022-2012-02-25-en)
- [The Register on the 2008 investigation](https://www.theregister.com/2008/02/21/front_running_investigation)
- [ICANN Registry Operator Code of Conduct](https://newgtldprogram.icann.org/en/node/1231)
- [Verisign RDAP terms](https://www.verisign.com/domain-names/registration-data-access-protocol/terms-service/index.xhtml)
- [Google Public DNS privacy](https://developers.google.com/speed/public-dns/privacy)
- [Squarespace purchase of Google Domains registrations](https://domains.google.com)
- [Identity Digital RDDS policy](https://www.identity.digital/policies/rdds-access-policy)
- [Identity Digital on Wikipedia](https://en.wikipedia.org/wiki/Identity_Digital)
- [CentralNic Registry](https://centralnicregistry.com/about)
- [CentralNic deals on Domain Incite](https://domainincite.com/?p=16893)
- [Vertical integration on ICANNWiki](https://icannwiki.org/VI)
