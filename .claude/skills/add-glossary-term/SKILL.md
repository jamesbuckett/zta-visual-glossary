---
name: add-glossary-term
description: >-
  Use when adding a term to the Visual Tech Glossary or editing an existing entry's data or
  diagram — triggers on "add <X> to the glossary", "add <X>", "new entry for <X>", "add a
  term", "add a domain/type tag". Covers the TERMS entry, the inline-SVG diagram, reverse
  cross-links, the six counters, glossary.txt, the browser verification loop, and the
  two-commit convention. Skip for changes that touch no term — styling, README-only edits,
  or work on the tooling scripts.
---

# Add a glossary term

Established over the nDLP and SBC entries (July 2026) and held since. Follow the steps in
order. Grid and TOC sort alphabetically at runtime, so array position is cosmetic —
append new entries at the end.

## 1. Append the `TERMS` entry

Add an object to `const TERMS` in `index.html`:

```js
{
  id: "kebab-id", term: "Display Name", acronym: "Expansion If Any",
  aliases: ["searchable synonym"],
  tldr: "One line, plain language.",
  explainer: `Two to four sentences ... closing with one candid limitation.`,
  types: ["Protocol"], provenance: ["Open Source"], domains: ["Zero-Trust Core"],
  related: ["sibling-id"],
  source: { label: "RFC 9999 — Title", url: "https://..." },
  caption: "What the diagram shows.",
  steps: [
    { title: "Two to four words", text: "One or two sentences, only what the explainer says." },
    …  // 3–5 steps
  ],
  fact: "One sentence from the explainer worth remembering.",
  takeaways: [
    { title: "Two to four words", text: "One sentence, at most 30 words, only what the explainer says." },
    …  // 3–5 takeaways; the last is the limitation
  ]
}
```

`types`, `provenance` and `domains` draw only on the existing `TYPE_TAGS`, `PROV_TAGS` and
`DOMAIN_TAGS` arrays. UK spelling. See CLAUDE.md for the source-verification rule.

`takeaways` are the tiles under the infographic: the explainer compressed to three to
five cards, the last always the limitation. They state only what the explainer says and
never repeat a tour step or the key fact word for word, or with only a word or two
changed. Every card names its subject rather than opening with a bare "It" or "Its",
because tiles are read one at a time. A limitation that spans several sentences goes
into the one last card, ending on the residual risk, and a partial mitigation never gets
a card of its own. Qualifiers such as "in practice", "can" and "most", and the condition
a guarantee depends on, survive the compression.

`npm test` checks only the count, the title length, the 30-word cap and word-for-word
copies. The rest are review rules: after writing the cards, re-read each one against the
explainer and confirm it adds, sharpens or generalises nothing, that the last card is the
explainer's closing limitation, and that no card is a step or the fact lightly reworded.

Keep `takeaways: [` and its closing `]` on their own lines at six spaces in `index.html`:
`test/takeaways-fixtures.mjs` finds the field by that shape.

## 2. Append the diagram and its tour

Add a matching `DIAGRAMS.<id>` function returning inline SVG, `viewBox` 720 wide and
~240–320 tall. Every diagram is a step-through tour: the term's `steps` drive numbered
chips, and each diagram element that belongs to a step carries `data-s="1 3"`.

- shapes — `box`, `box-accent`, `box-soft`, `zone`, `zone-accent`, and two outlines that
  are not a rect: `${cyl(x, y, w, h)}` for a data store and `${doc(x, y, w, h)}` for a
  data asset. Both take `'box-accent'` as a fifth argument. Which one a node gets is set
  by its CALM node type: see step 2b.
- flows — `flow`, `flow-accent`, `flow-ok`, `flow-bad`. Every flow animates in drawing
  order, so draw each line from source to destination, arrowhead or not. A two-way
  arrow (both markers) sways; `flow-bad` lurches and stalls.
- boundaries — `divider`, `zone`, `zone-accent` light up too (accent stroke, no moving
  dash), so a boundary or region can be a step's focus: tag it, or its group
- arrowheads — `ah-acc`, `ah-ok`, `ah-bad`, `ah-mut`
- text — `t-b`, `t-sm`, `t-mut`, `t-acc` (accent — never a `fill="var(--accent)"`
  attribute, which the `.dg text` rule silently overrides)
- icons — `${icon('server', x, y)}`: a 24px Lucide icon at the top-left of a main box,
  with its label shifted right. Add a missing icon to `ICONS` from lucide-static.
- badges — `${badge(n, x, y, '1 3')}`: one numbered circle per step, on the element or
  arrow that step centres on; the last argument lists the steps it lights, like `data-s`.

Set `aria-label` to the caption text. Budget label widths at roughly 6.6px per character
for the ~11px mono face. Build a table or aligned columns from one `<text>` per cell,
each at its own `x`: SVG collapses a run of spaces to one, so space-padded columns render
squashed together.

Rules: 3–5 steps; every step lights something; tag a component's `<g>`, never both a
group and its children (no nested `data-s`); a flow may run under its badge, but a
badge must not cover a label; no icon repeated within one diagram unless the things are
the same kind; the drawing must read correctly fully lit (print).
Tour copy states only what the explainer says.

## 2b. Write the CALM model and tag the drawing

Every diagram has a model in `const CALM`, keyed by term id, in the FINOS CALM 1.2
format. Write the model from the explainer, then make the drawing match it. The page
adds `$schema` and `metadata` itself; store only `nodes`, `relationships` and `flows`.

```js
kebabid: {
  "nodes": [
    { "unique-id": "client", "node-type": "system", "name": "Client", "description": "The client needs the IP address behind a human-readable name." },
    { "unique-id": "resolver", "node-type": "service", "name": "Resolver", "description": "The resolver walks the hierarchy and caches answers to stay fast." }
  ],
  "relationships": [
    { "unique-id": "client-resolver", "description": "The client asks the resolver to resolve a name into an IP address.",
      "relationship-type": { "connects": { "source": { "node": "client" }, "destination": { "node": "resolver" } } } }
  ],
  "flows": [
    { "unique-id": "resolve", "name": "Recursive resolution", "description": "The resolver walks root, TLD, then authoritative, and caches the answer.",
      "transitions": [
        { "relationship-unique-id": "client-resolver", "sequence-number": 1, "description": "The client asks the resolver for the IP address behind a name." }
      ] }
  ]
}
```

**Nodes.** `name` is the title drawn in the shape, word for word, in one `<text>`.
`description` is one sentence that says only what the term's own copy says: its
explainer first, and its caption and tour steps where the explainer is silent. It must
still make sense read on its own in the downloaded JSON: name the thing, never "it". Pick the
built-in `node-type` that honestly fits; otherwise use a custom kebab-case type such as
`layer`. Three rules settle the common cases:

- `actor` is for people and organisations only. A client machine or program is a
  `system`, or a `webclient` if it is a browser or an app's user interface. An
  application takes its type from its role in the term's exchange: the party that sends
  the requests is a `system` (OIDC's relying app, an app binding to a directory), the party
  that answers them is a `service` (an app the IdP provisions or issues to); where it does
  both, the copy's own word decides.
- When a built-in name collides with the term's own vocabulary, use a custom type. A
  Kubernetes pod is a `pod`, not a `service`, because a Service is a different
  Kubernetes object.
- Something a component reads and writes as it runs (a cache, a lookup table, an index,
  a log) is a `database`. Something made once (a certificate, a manifest, a policy file)
  is a `data-asset`. The line between them is persistence: a `database` outlives the
  component's runs and is read and written by them; a representation a component builds
  afresh and hands on each time it runs (React's virtual DOM, a rendered template) is a
  `data-asset`. Whether an artefact is a node at all is a
  separate question: it is one when it is what the term defines or exists to manage (a JWT, an
  SVID, a SPIFFE ID, a SAML assertion, a vault's secrets, PKI's certificates), or when a party
  holds it as its own (a key or verifier made for itself, a certificate or trust anchor it
  reads, a policy or config the copy places nowhere). Anything one party issues, returns or
  presents to another inside the exchange the tour narrates (a token, a code, a challenge, a
  credential) is what the link carries and appears only in descriptions, however long it
  lives or whether it can be revoked; and a thing named only inside a limitation stays in that
  description.

You may add a node for something the old drawing only labelled, when the term's copy
names it: a "private network" label becomes a zone around its hosts. Do not invent a node
the copy does not name. Instances of a class the copy names (your devices as Device A, B and
C; each startup stage as Firmware and OS) count as named, provided each description claims
only what the copy says of the class. An endpoint the copy's named links require but never
names (the far end of SD-WAN's transports, NAT's public side) stays a node, typed by what
it is and described only as the far end of those links in the copy's words. A box that stands for where a mirrored or inline path begins (IDS/IPS's network traffic) is such a far end, a `network` node, not a request `call-out`: a request is what a link carries, while a path needs somewhere to start. An artefact the copy says stays inside its holder (a key sealed
in a TPM) is a `composed-of` part drawn inside it; one that is presented, shared, fetched
or handed on (a certificate, a public key, a config file) is a separate `data-asset`
joined to its holder by an arrow. The two halves of a key pair are judged separately: the half
that never leaves its holder is a `composed-of` part, and the half handed to another party
inside the narrated exchange (a public key and credential ID registered with a site) is
what that link carries, even though the other party stores it; a key or certificate the
holder keeps as its own and presents stays a node. A network that a link only crosses, with nothing
deployed in it, is a `call-out` zone named in the link's description, not a node. A trust anchor the copy says a party holds (a root CA's certificate) is a
`data-asset` that party reads, like any other certificate. An artefact the copy places
nowhere, neither inside its holder nor handed on (a policy, an audit log), is a separate
node joined by an arrow: a `data-asset` if made once, a `database` if written at run time. An artefact the copy says a component runs or executes (SOAR's playbooks, OPA's policy) is placed nowhere in that sense: a separate `data-asset` joined to the component by a "runs" arrow, not a `composed-of` part. A store the copy names only by the component's own verb ("stores", "keeps", "caches") is a `database` composed into that component (SIEM's store, OVS's flow tables).
A policy or set of rules is such an artefact only when the copy treats it as a thing of its
own (authored, versioned, pushed, compiled, or given a default-deny of its own: OPA's policy,
Immuta's, OpenZiti's service policy); rules the copy names only as what a component evaluates
or applies (RBAC's engine, a PDP, a segment's rules) stay in that component's description.

The type sets the outline:

| Node type | Outline |
|---|---|
| `actor`, `webclient` | `<rect class="box" … rx="20"/>` |
| `service`, `system`, any custom type | `<rect class="box" … rx="8"/>` (any `rx` under 16 counts as square) |
| `database`, `ldap` | `${cyl(x, y, w, h)}` |
| `data-asset` | `${doc(x, y, w, h)}` |
| `network`, `ecosystem` | `<rect class="zone" …/>` |
| a container through `deployed-in` | `<rect class="zone" …/>`, whatever its type |
| a container through `composed-of` | `<rect class="box-soft" …/>`, whatever its type |

Every modelled node carries its type word, drawn by the page from the model; leave one
corner of each node clear of title, sub-label, icon and badge, about 12 units high and the
word's width (`DATA ASSET` is the widest built-in; a custom type can be wider; budget about 6.1 units per character), or
`npm run verify` reports `calm-type`. The page tries bottom-right, top-right, bottom-left,
then top-left (top-right first in a container, whose title sits top-left), sets the word
12 in from the side of a rounded outline (8 otherwise), and keeps a cylinder's word clear
of its top rim. Siblings of one type and one outline size in a drawing take the same
corner when a corner is clear for all of them (the first in the usual order); first-fit
per node applies only when no corner is clear for the whole set. To make room:

- Move a badge to free a corner, as long as the badge stays beside what it marks. Prefer
  that to growing a node.
- Otherwise give the node more height or move a sub-label; nothing else moves unless the
  extra height pushes it.
- Siblings that were equal before stay equal: when one node of a matched set (a row of
  hosts, the heads of a sequence diagram, the segments of a token, three zones side by
  side) has to grow, grow the set with it, or free the corner another way so none grows.

**Relationships.** Use `connects` (source to destination) between two nodes,
`interacts` (actor to node) for a node typed `actor` and what it uses, `deployed-in` for a node that
runs inside another, `composed-of` for a node that is a part of another. A request and
its reply are one relationship. Direction follows the data: a component that writes or
produces a `data-asset` is the source and the asset the destination; an asset is the
source for a component that reads it; a `database` is the destination of whatever reads
or writes it, as a store is to its clients. Draw the arrow the same way, and make a
lookup or fetch request drawn the other way a `destination-to-source` transition. Set `protocol` only if it is one of CALM's twelve (HTTP,
HTTPS, FTP, SFTP, JDBC, WebSocket, SocketIO, LDAP, AMQP, TLS, mTLS, TCP); otherwise name
the protocol in the description, unless the term is itself that protocol. Every node must appear in at least one relationship. A
node is a container through one of the two kinds, never both. A relationship's description says what passes between its two nodes, in one sentence;
the term's limitations belong to the node they are about, not to a link, except a
limitation that is a property of the link itself (its transport, its encryption, its
ordering), which ends the link's description after what passes. Two actors may be joined
by `interacts` only when the copy names organisations or people and no system of theirs.
Where the tour's order differs from the protocol's, the transition descriptions say the
protocol's order. Write each description so
it makes sense on its own, as for nodes.

**Flow.** Write one flow when the tour narrates traffic: if it lights any arrow, the
model has a flow. List the transitions in the order the tour lights their connectors,
numbered 1 to N. When one party fans the same event out to several instances (an IdP
provisioning three apps), write one transition per instance and one connector each, and
draw the events the steps narrate as a lit list beside the source rather than as a line per
event. The flow follows the tour's order even where the tour is conceptual rather than
chronological: a model mirrors how the term is explained, not a packet trace. A reply, or any traffic going back over the same link, is a transition
with `"direction": "destination-to-source"`. Each transition needs a lit connector of its
own, drawn in its direction; a connector lit at several steps can serve a transition at
any of them. A two-way arrow stands for traffic each way, so it must have one transition
each way; draw a link with no return traffic in the model one-way. The two halves of a
handshake or key exchange carry no protocol detail the copy does not give: "the client
sends its side" is enough. The tour may also
light a connector that is not a transition, to show structure: "every device plugs into
the switch" lights three links and adds nothing to the flow.

**Tagging.**

- Each node is one `<g data-calm="<node id>">` holding its outline, icon and labels. A
  sequence diagram's lifeline goes in its node's group. The first outline in the group
  is the one the shape rule checks.
- A container's group holds its outline and its own label only. Its children are sibling
  groups drawn inside it. Never nest one `data-calm` in another.
- Each connector is one `<line>` or `<path>` carrying `data-calm="<relationship id>"`,
  drawn from one node's edge to the other's, or to a labelled entry inside the node's
  outline when that reads better (a bind landing on a directory entry). Redraw a shared
  trunk as separate full-length lines.
- `data-calm` and `data-s` go on the same element.
- Anything else drawn with a `box`, `zone` or `flow` class is not part of the
  architecture and says so with `data-note` on it or its group. The value is one of six,
  and `verify.mjs` rejects any other:
  - `call-out`: a box or arrow that explains a part of the drawing, including the practice
    the subject replaces (a hard-coded password beside a vault). A request box with no
    named sender is a `call-out`, because a request is what a link carries and a node for
    its sender would be invented (WAF's Benign and Exploit, Django's Request).
  - `footer`: a strip of text under the drawing, usually the limitation
  - `elided`: a row or box standing for things the explainer does not name
  - `self-loop`: a line from a component back to itself
  - `struck-through`: a broken or stalled primitive, and the X that marks it
  - `becomes`: an arrow joining the same thing at two moments, or a thing and what it
    turns into
- Free text, dividers and badges need no tag.

If the drawing disagrees with the explainer, the drawing changes. If the model shows
the explainer itself may be wrong, report it; do not edit the explainer here.

## 3. Cross-link

Add a reverse `related:` entry on the closest sibling term, so the link works both ways.

## 4. Bump the six counters and the README

Static fallbacks in the committed HTML: `toc-count`, `stat-total`, `stat-types`,
`stat-prov`, `stat-domains`, `stat-diagrams` — plus the term count in the README's
"Explains N …" sentence.

All six are overwritten at runtime from `TERMS` / `TYPE_TAGS` / `PROV_TAGS` /
`DOMAIN_TAGS`, so a stale number only shows pre-JS. Before that wiring existed they drifted
silently and were wrong on the "AI & Models" commit — bump them anyway.

## 5. Regenerate `glossary.txt`

```bash
npm run glossary
```

It prints the term count, which cross-checks step 4. Commit the result alongside
`index.html` and `README.md`.

## 6. Verify

```bash
npm test               # validate.mjs — style-guide linter, must exit clean
npm run verify <id>    # the rendered checks for your term
```

`verify.mjs` replaces the scratchpad harness this step used to describe. For your term it
asserts the detail view and diagram render, the TOC entry exists, the console is clean
and no label runs outside the viewBox, and runs five checks, the first two of them the
geometry checks that have caught defects invisible at thumbnail size:

- **(a) Label clearance** — every `<text>`, icon and badge against every outline that is
  not a zone: a `<rect>`, a cylinder or a document. One that overlaps an outline without
  sitting inside it, by more than 2 units, is an error. Caught Calico's "no match" and
  "pod IP on the wire".
- **(b) Stroke/text collision** — ~200 samples along every `<line>`/`<path>`; none may land
  inside a label. Caught istiod's arrows striking through Istio's SPIFFE ID line, which
  check (a) could not see.
- **(c) Diagram tour** — chips match `steps`, each step lights something, clicks and
  ArrowRight work, nothing animates under reduced motion, no badge covers a label.
- **(d) Takeaway tiles** — tiles match `takeaways`, only the last is marked as the
  limitation, the full explainer sits in a closed disclosure that opens for print, and
  nothing overflows at 1440px or 375px.
- **(e) CALM model** — every node drawn once under its name, in the outline its type
  calls for; every `connects` and `interacts` relationship drawn as a connector between
  the right two nodes; contained nodes inside their container, and no connector tagged
  with a `deployed-in` or `composed-of` relationship; the flow in the tour's order;
  nothing with a `box`, `zone` or `flow` class left untagged; and, under the rule
  `calm-type`, every node's type word present, inside its outline and clear of every
  other label, icon and badge. It also checks the "CALM model" disclosure: its JSON,
  Copy, Download and print.

It also re-checks the step 4 counters, so a bare `npm run verify` catches drift you missed.

`npm test` checks the model itself: it validates against the vendored CALM 1.2 schema,
and its ids and references hold. To check a model with FINOS's own tool, save the
downloads and run the CLI over one:

```bash
node verify.mjs <id> --calm-out=/path/outside/the/repo
npx --yes @finos/calm-cli@1.60.1 validate -a /path/outside/the/repo/<id>.calm.json
```

Two things worth knowing if you extend it: measure in **screen space**
(`getBoundingClientRect`, and map `getPointAtLength` results through `getScreenCTM`) —
`getBBox()` ignores transforms and reports a phantom horizontal box for rotated text. And
`stroke-bad` lines are the decorative X struck over a broken primitive, so they are
excluded from check (b) by design.

Finally, read the light and dark element screenshots of `#detail-content` — the geometry
checks do not judge whether the diagram is *right*, only that nothing collides.

## 7. Refresh the committed screenshots

```bash
node screenshot.mjs ./index.html               # desktop.png, tablet.png, mobile.png
node screenshot.mjs ./index.html --mode=dark   # dark-desktop.png, dark-tablet.png, dark-mobile.png
```

Run both: the default mode writes only the three light files, and the dark set is a
separate pass. `git status` should show all six files in `screenshots/` modified before
the screenshots commit.

No env prefix needed: `_launch.mjs` falls through to `/snap/bin/chromium`, and `verify.mjs`
sets the override itself. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` only if that fallback
chain ever comes up empty.

## 8. Commit

Two commits, direct to `main`, both with the `Co-Authored-By` trailer:

1. `feat: add <Term> to the glossary` — `index.html`, `README.md`, `glossary.txt`
2. `chore: refresh screenshots for the <term> entry` — `screenshots/`

The term's CALM model and its data-calm tags are part of commit 1.

Push only when James asks.
