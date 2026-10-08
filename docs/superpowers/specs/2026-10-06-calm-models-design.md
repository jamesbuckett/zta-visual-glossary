# CALM models behind every diagram — design

Date: 2026-10-06
Status: approved on 6 October 2026; plan in `docs/superpowers/plans/2026-10-06-calm-models.md`

## Goal

Give every term a machine-readable architecture model in the FINOS Common Architecture
Language Model (CALM) 1.2 format, and redraw each diagram so that it matches its model
one-to-one. A reader can open the model under the diagram, copy it, or download it and
take it into CALM tooling. `verify.mjs` proves that the drawing and the model agree.

The detail view becomes: title → TL;DR → infographic → takeaway tiles → full explainer
(collapsed) → CALM model (collapsed) → tags → source → related terms.

CALM is a JSON model, not a drawing notation. It defines nodes, relationships, flows and
controls and leaves the picture to tools. The diagrams therefore stay hand-authored inline
SVG; what changes is that each one is drawn from, and checked against, a model.

## Decisions

| Question | Decision |
|---|---|
| What CALM gives the glossary | A CALM model behind each drawing; the SVG is redrawn by hand to match it |
| Reader visibility | A closed "CALM model" disclosure per term: view, copy and download |
| Diagrams that are not architectures | Model all 105. Built-in node types where they fit, custom types where they do not |
| Redraw depth | Reshape to the model: redraw what disagrees, keep layouts, tours, captions and takeaways that match |
| Schema version | CALM release 1.2, the latest published under `calm/release/` on 6 October 2026 |
| Schema validation | `ajv` against a vendored copy of the 1.2 schema, plus the official CLI as a cross-check |
| New shapes | Cylinder for data stores, folded-corner document for data assets |
| Pilots | DNS, Kubernetes, OAuth, JWT, OWASP, reviewed before the other 100 |
| Branching | Commits go to `main`, as with the tours and takeaways work. Nothing is pushed until James asks |
| Pilot review, 6 October 2026 | Actors at `rx="20"`; `actor` for people and organisations only; a custom type where a built-in name collides; a transition each way for a two-way arrow; six `data-note` values; thin models stay |
| Batch 1 review, 6 October 2026 | The flow is a sub-story of the tour: a lit connector need not be a transition. Caption and steps are valid sources where the explainer is silent. A run-time store is a `database`, a made-once artefact a `data-asset`. A drawn label the copy names may become a node. |
| Type words on nodes (James, 2026-10-07, mid-batch 3) | Every modelled node carries its CALM type word, drawn by the page from the model at render time (small, muted, uppercase, in the first corner of the outline clear of the node's own title, sub-label, icon and badge; `DATA ASSET` with a space). Compact nodes get room in a tidy pass, and `verify.mjs` reports a word that overlaps text (`calm-type`). The shapes and the key line stay. Plan Task 8b |

Facts about the 1.2 schema that shape the design, read from
`calm/release/1.2/meta/core.json` and `flow.json` in `finos/architecture-as-code`:

- A node requires `unique-id`, `node-type`, `name` and `description`.
- `node-type` accepts nine built-in values (`actor`, `ecosystem`, `system`, `service`,
  `database`, `network`, `ldap`, `webclient`, `data-asset`) or any other string.
- A relationship requires `unique-id` and a `relationship-type` holding exactly one of
  `interacts`, `connects`, `deployed-in`, `composed-of` or `options`.
- `protocol` is a closed list of twelve: HTTP, HTTPS, FTP, SFTP, JDBC, WebSocket, SocketIO,
  LDAP, AMQP, TLS, mTLS, TCP. It has no UDP, QUIC, DNS, BGP, SSH or MQTT.
- A flow requires `unique-id`, `name`, `description` and at least one transition. A
  transition names a relationship, carries an integer `sequence-number` and a
  `description`, and may set `direction` to `destination-to-source`.

## 1. Data model

### Where the model lives

A new `const CALM = { … }` object in `index.html`, placed directly after `DIAGRAMS`. Its
keys are term ids; each value is one CALM architecture written as a JSON-compatible object
literal with quoted keys:

```js
const CALM = {
  dns: {
    "nodes": [
      { "unique-id": "client", "node-type": "webclient", "name": "Client",
        "description": "Wants the IP address of example.com." },
      { "unique-id": "resolver", "node-type": "service", "name": "Resolver",
        "description": "Asks each level in turn and caches the answers." },
      …
    ],
    "relationships": [
      { "unique-id": "client-resolver", "description": "The client queries the resolver over DNS.",
        "relationship-type": { "connects": { "source": { "node": "client" }, "destination": { "node": "resolver" } } } },
      …
    ],
    "flows": [
      { "unique-id": "resolve", "name": "Recursive resolution",
        "description": "The resolver walks root, TLD, then authoritative, and caches the answer.",
        "transitions": [
          { "relationship-unique-id": "client-resolver", "sequence-number": 1, "description": "The client asks for the address." },
          …
          { "relationship-unique-id": "client-resolver", "sequence-number": 5, "description": "The resolver returns the answer.", "direction": "destination-to-source" }
        ] }
    ]
  },
  …
};
```

The example shows the shape only; the pilot writes the real DNS model.

The stored model holds `nodes`, `relationships` and, where the tour walks connectors,
`flows`. When the page shows or downloads a model it adds two things from the `TERMS`
entry, so nothing is stored twice:

- `"$schema": "https://calm.finos.org/release/1.2/meta/calm.json"`
- `"metadata": { "term": …, "glossary-id": …, "caption": …, "source": … }`

### Nodes

- `unique-id`: kebab-case, unique within the model. Ids are scoped to one term.
- `node-type`: a built-in value where one honestly fits. Otherwise a custom kebab-case
  string that says what the thing is, such as `layer` or `policy`.
- `actor` is for people and organisations only. A client machine or program is a `system`, or a `webclient` if it is a browser or an app's user interface.
- When a built-in name collides with the term's own vocabulary, use a custom type: a Kubernetes pod is a `pod`, not a `service`.
- `name`: the title drawn in the node's shape, word for word. It fits one `<text>`
  element; a title that wraps today is shortened or its box widened.
- `description`: one sentence, stating only what the term's own copy says: its
  `explainer` first, and its caption and tour steps where the explainer is silent. UK
  spelling.
- Something a component reads and writes as it runs (a cache, a lookup table, an index, a
  log) is a `database`; something made once (a certificate, a manifest) is a `data-asset`. The line between them is persistence: a `database` outlives the
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

### Relationships

| Type | Used for |
|---|---|
| `connects` | A directed link between two nodes, `source` to `destination` |
| `interacts` | A node typed `actor` and the nodes it uses |
| `deployed-in` | A node that runs inside another: a pod in a worker node |
| `composed-of` | A node that is a part of another: a header in a token |

- Direction follows the data: a component that produces a `data-asset` is the source and
  the asset the destination; an asset is the source for a component that reads it; a
  `database` is the destination of whatever reads or writes it. A fetch or lookup drawn
  the other way is a `destination-to-source` transition.
- A relationship's description says what passes between its two nodes, in one sentence.
  The term's limitations belong to the node they are about, not to a link, except a
  limitation that is a property of the link itself (its transport, its encryption, its
  ordering), which ends the link's description after what passes.
- Two actors may be joined by `interacts` only when the copy names organisations or
  people and no system of theirs.
- An artefact the copy says stays inside its holder is a `composed-of` part; one that is
  presented, shared, fetched or handed on is a separate `data-asset` joined by an arrow.
  A network that a link only crosses, with nothing deployed in it, is a `call-out` zone
  named in the link's description.
- The two halves of a handshake or key exchange carry no protocol detail the copy does
  not give.
- A trust anchor the copy says a party holds is a `data-asset` that party reads. An
  artefact the copy places nowhere is a separate node joined by an arrow: `data-asset` if
  made once, `database` if written at run time. Instances of a class the copy names count
  as named. A `call-out` may show the practice the subject replaces. A request box with no named sender is a `call-out`, because a request is
  what a link carries and a node for its sender would be invented (WAF's Benign and Exploit,
  Django's Request).
- An endpoint the copy's named links require but never names (the far end of SD-WAN's
  transports, NAT's public side) stays a node, typed by what it is and described only as
  the far end of those links in the copy's words.
- An artefact is a node when it is what the term defines or exists to manage, or when a
  party holds it as its own; anything one party issues, returns or presents to another
  inside the narrated exchange (a token, a code, a challenge) is what the link carries,
  however long it lives; a thing named only inside a limitation stays in that description
  (batch 4 review: IdP's token is link content, SAML's assertion and OIDC's ID token are
  nodes).
- The two halves of a key pair are judged separately: the half that never leaves its
  holder is a `composed-of` part; the half handed to another party inside the narrated
  exchange (a public key and credential ID registered with a site) is what that link
  carries, even though the other party stores it; a key or certificate the holder keeps as
  its own and presents stays a node (batch 5 review).
- A policy or set of rules is a node only when the copy treats it as a thing of its own
  (authored, versioned, pushed, compiled, or given a default-deny of its own: OPA's policy,
  Immuta's, OpenZiti's service policy); rules the copy names only as what a component
  evaluates or applies (RBAC's engine, a PDP, a segment's rules) stay in that component's
  description (batch 6 review).
- An application takes its type from its role in the term's exchange: requester `system`,
  answerer `service`. A connector may end on a labelled entry inside its node's outline.
  A fan-out of one event to several instances is one transition and one connector per
  instance, with the events as a lit list (batch 4 review). Where the tour's order differs from the protocol's, the
  transition descriptions say the protocol's order.
- `protocol` appears only when CALM's list has the protocol. Otherwise the relationship's
  `description` names it.
- A request and its reply are one relationship. The reply is a flow transition with
  `direction: "destination-to-source"`, not a second relationship.
- A node is a container through `deployed-in` or through `composed-of`, never both.
- `interacts` runs from the actor to the node it uses; that is its forward direction.
- Every node is named by at least one relationship. The official CLI warns about a node
  that is not.
- `options` is not used.

### Flows

A model has one flow when the tour narrates traffic: if the tour lights any arrow, the
model has a flow (JWT's anatomy tour lights parts, not connectors). The flow mirrors the tour:

- Transitions appear in the order the tour lights their connectors, even where the tour is
  conceptual rather than chronological.
- Each transition has a lit connector of its own; a connector lit at several steps can
  serve a transition at any of them.
- The tour may light a connector that is not a transition, to show structure.
- `sequence-number` runs 1 to N with no gaps or repeats.
- Each transition has its own drawn connector, drawn in the transition's direction. A
  two-way arrow, with a marker at both ends, stands for a request and its reply and must have one transition in each direction; a link with no reply in the model is drawn one-way.
- The flow's `description` is the term's `caption` or a sentence from the explainer.

Tour steps and transitions are not one-to-one: a step may light only a node, or several
connectors. The flow records the connector traffic; the tour remains the reader's guide.

### Left out

Controls, interfaces, `options`, patterns, decorators, timelines and ADR links. See
"Out of scope".

## 2. Drawing rules

### Node type to shape

| Node type | Shape | Status |
|---|---|---|
| `actor`, `webclient` | Rounded box, `rx="20"` | Rounder than today's 12, so it reads at a glance |
| `service`, `system`, custom types | Square-cornered box, `rx="8"` (any `rx` under 16 counts as square) | Today's convention |
| `database`, `ldap` | Cylinder | New |
| `data-asset` | Document with a folded corner | New |
| `network`, `ecosystem`, and any node that contains others | Zone | Today's zone |

A node that contains others is drawn as a container whatever its type. Two helpers join
`icon()` and `badge()` and emit the new outlines: `<path class="box shape-cyl">` and
`<path class="box shape-doc">`, each with an accent variant on `box-accent`.

Every modelled node carries its type word, drawn by the page from the model; leave one
corner of each node clear of title, sub-label, icon and badge, about 12 units high and the
word's width (`DATA ASSET` is the widest built-in; a custom type can be wider), or
`npm run verify` reports `calm-type`.

- A badge may move to free a corner, as long as it stays beside what it marks. That is
  preferred to growing a node.
- Siblings that were equal stay equal: when one node of a matched set (a row of hosts, the
  heads of a sequence diagram, the segments of a token, three zones side by side) has to
  grow, the set grows with it, or the corner is freed another way so none grows.
- Siblings of one type and one outline size in a drawing take the same corner when a
  corner is clear for all of them (the first in the usual order); first-fit per node
  applies only when no corner is clear for the whole set.

### Relationship to mark

| Relationship | Mark |
|---|---|
| `connects`, `interacts` | An arrow from one node's edge to the other's |
| `deployed-in` | The child drawn inside a dashed zone (`zone`, `zone-accent`) |
| `composed-of` | The child drawn inside a solid-bordered container (`box-soft`) |

Colour keeps today's meaning: accent is the subject or the secure path, green and red are
allow and deny. Colour says nothing about node or relationship type.

### Tagging

- Each node is one `<g data-calm="<unique-id>">` holding its shape, icon and labels. A
  sequence diagram's lifeline belongs to its node's group.
- The first shape element in the group is the node's outline, and the shape rule applies
  to it. Further shapes inside the group are detail of that node and are not checked.
- A container's group holds its outline and its own label, not its children. Children are
  sibling groups. `data-calm` is never nested, the same rule as `data-s`.
- Each connector is one SVG element carrying `data-calm="<relationship unique-id>"`,
  running from one node to the other. Shared trunks are redrawn as separate full-length
  connectors.
- `data-calm` and `data-s` sit on the same element.
- Every `box`, `box-accent`, `box-soft`, `zone` and `zone-accent` element sits inside a
  node's group, and every `flow*` element carries a relationship's id. A purely
  illustrative mark, such as a call-out box, a footer strip, an elided row, a self-loop or
  the X over a broken or stalled primitive, opts out with `data-note`, set to one of the six
  values below, on itself or its group.
- `data-note` takes one of six values, and `verify.mjs` rejects any other: `call-out`, `footer`, `elided`, `self-loop`, `struck-through`, `becomes` (the same thing at two moments, or a thing and what it turns into).
- Free-text annotations, footnotes, dividers and badges are not model elements and need no
  tag.

### What "reshape to the model" means per diagram

1. Write the model from the explainer and the current drawing.
2. Keep every part of the layout that already agrees with the model.
3. Redraw what does not: a shape that contradicts its node type, a connector with no
   relationship, a relationship with no connector, a child drawn outside its container,
   a shared trunk.
4. Tag every node and connector.
5. Leave `steps`, `fact`, `caption` and `takeaways` alone unless the redraw makes one
   false. Any reworded caption or step is listed in the batch summary.

Where a drawing disagrees with its explainer, the drawing changes. Explainers, takeaways
and sources are not edited in this work; a suspected error in one is reported, not fixed.

## 3. Page

### Markup

`calmHtml(e)` returns the disclosure for a term that has a model and an empty string
otherwise. `detailHtml` places it after `takeawaysHtml(e)`, which already ends with the
full-explainer disclosure.

```html
<details class="calm-more">
  <summary>CALM model</summary>
  <p>This diagram as architecture as code: a model in the FINOS
     <a href="https://calm.finos.org/">Common Architecture Language Model</a> (CALM),
     release 1.2.</p>
  <p class="calm-counts">6 nodes · 5 relationships · 5 flow steps</p>
  <p class="calm-key">Rounded box: actor or web client. Square box: service, system
     or other component. Cylinder: data store. Folded document: data asset. Dashed zone: network, or deployed in.
     Solid container: composed of.</p>
  <div class="calm-actions">
    <button type="button" data-calm-copy>Copy</button>
    <button type="button" data-calm-download>Download</button>
    <span class="calm-status" aria-live="polite"></span>
  </div>
  <pre class="calm-json"><code>…</code></pre>
</details>
```

- The JSON is the stored model with `$schema` and `metadata` added, pretty-printed with a
  two-space indent and HTML-escaped.
- The key is plain text, with no swatches.
- The summary carries the same chevron icon as the explainer disclosure.
- The intro sentence links out. CALM is not a glossary term in this work.

### Styling

- `.calm-more` reuses the `.explainer-more` summary treatment, including the chevron.
- `.calm-json` scrolls inside itself in both directions, with a capped height, so the page
  never scrolls sideways at phone width.
- Buttons reuse an existing button style. No new colour; spacing on the scale; no emoji.

### Behaviour

- Copy writes the JSON to the clipboard and sets the status text to "Copied".
- Download saves the same text as `<id>.calm.json` through a Blob URL.
- The disclosure is closed by default and is not forced open for print, unlike the
  explainer.

### Type words

- One rule beside the other `.dg` text classes:
  `.dg .calm-type { font-size: 9px; fill: var(--text-muted); letter-spacing: .08em; }`.
- `labelCalmTypes(fig)` is called from `showDetail()` once the detail view is unhidden,
  because geometry reads as zero while it is hidden, and again whenever the page's web
  fonts finish loading (`document.fonts`, `loadingdone`), because it measures text. A term
  with no model gets no words.
- For each node of `CALM[id]` it appends `<text class="calm-type">` to the node's
  `data-calm` group, holding the `node-type` uppercased with hyphens as spaces, so the word
  dims with its node. It places the word inside the node's outline at a corner clear of
  every label, icon (taken as a 24 by 24 box at its translate, since `getBBox()` ignores
  transforms) and badge in the drawing, of the outlines of other nodes (except a container
  that holds this one) and of a document's fold. Corners are tried bottom-right,
  top-right, bottom-left, top-left, with top-right first in a container (`zone`,
  `zone-accent`, `box-soft`), whose own title sits top-left.
- Nodes with the same type word and the same outline (class, width and height) take the
  same corner: the first in that order that is clear for all of them. Only when none is
  does each take its own first clear corner.
- The word sits 8 in from the outline's side, or 12 for a rounded outline (`rx` 16 or
  more), whose curve cuts into the corner, with its baseline 14 below the top or 7 above
  the bottom. On a cylinder the baseline sits 10 below the top rim, measured at the
  deepest point of the rim over the word's width (the rim is half an ellipse 8 deep across
  the outline), or 12 above the base.
- With no clear corner the word goes bottom-right, in a container too, and check (e)
  reports it.
- The key line in the disclosure is unchanged.

## 4. Tooling and verification

### `_terms.mjs`

`extractObject(html, name)` walks `const CALM = {` to its matching brace, as
`extractArray` does for brackets, and evaluates the literal in a bare context.
Phase 1 adds the declaration, empty, so `readTerms` always returns `CALM`.

### `validate.mjs` (`npm test`)

- `CALM` parses. A failure is a `data-parse` error like the existing ones.
- Every `CALM` key is a term id. After lock-in, every term id has a model.
- Each stored model validates against CALM 1.2 `core.json`. The eleven schema files under
  `calm/release/1.2/meta/` are vendored into `test/calm-schema/1.2/`, with a README giving
  the source URL and the date fetched. `ajv` (2020-12 dialect) is a new devDependency; it
  loads the four files an architecture needs: core, control, flow and interface.
- Reference checks the schema cannot express:
  - a stored model holds only `nodes`, `relationships` and `flows`, and has at least one
    node
  - node ids are unique, relationship ids are unique, and both are kebab-case
  - every node is named by at least one relationship
  - every node a relationship names exists
  - an `interacts` relationship's actor is a node typed `actor`
  - no node contains itself, and no node is a container through both `deployed-in` and
    `composed-of`
  - every relationship a transition names exists and is drawn as a connector (`connects`
    or `interacts`)
  - sequence numbers run 1 to N
  - a model has at most one flow

`validate.mjs` is dependency-free today and runs from the project hook after every
`index.html` write. With `ajv` it needs `npm install` to have run; if the import fails it
reports that plainly rather than a stack trace.

### `verify.mjs`, per term with a model — check (e)

Model against drawing, measured in screen space like the existing checks:

- Every node is drawn exactly once: one element with `data-calm` equal to its id.
- The node's group contains a `<text>` equal to its `name`.
- The node's shape matches its node type, by the table in section 2.
- Every `connects` and `interacts` relationship has at least one connector. Each
  connector's two ends land on the groups of the two nodes the relationship names, within
  a tolerance that starts at 6 viewBox units and is tuned in the pilot. For `interacts`,
  every listed node is reached.
- A connector drawn against its relationship's direction has a
  `destination-to-source` transition on that relationship. A two-way arrow has a transition in each direction.
- Every child of a `deployed-in` or `composed-of` relationship sits inside its container,
  and the container's border is dashed or solid to match.
- Walking the flow's transitions in sequence order, each has its own connector in the
  transition's direction, lit at a tour step no earlier than the one chosen for the
  previous transition. A connector lit at several steps can serve a transition at any of
  them.
- Every `box*` and `zone*` element is inside a node's group or covered by a `data-note`,
  and every `flow*` element carries `data-calm` or `data-note`. Every `data-calm` value
  names a node or relationship in the model.
- Every `data-note` value is one of the six.
- If the tour lights any arrow, the model has a flow. A lit connector need not be a
  transition.
- Type words, reported under their own rule, `calm-type`: every node's group holds exactly
  one `.calm-type` text, reading the node's type word; it lies inside the node's outline;
  and no other text, icon or badge in the drawing shares its line, in screen space: none
  overlaps it vertically by more than the 2-unit cushion the other geometry checks allow
  while overlapping it, or sitting less than 3 units beside it, horizontally. The page
  leaves 4 units beside a word, so one that only just misses its neighbour was placed with
  no clear corner; lines stacked above or below, whose boxes touch, are not counted. A
  finding names the node and what its word overlaps or sits beside. The word is also an
  ordinary label to checks (a) and (b), so a word across a box border or under a connector
  is reported there too.

The disclosure, at 1440px. At 375px, with it open, the checks that can differ by width run again: it is present, its JSON is unchanged, Copy, Download and the JSON block are rendered, the keyboard attributes hold, and nothing overflows:

- It is present, closed by default, and stays closed for print.
- Its JSON parses, and its `nodes`, `relationships` and `flows` equal the stored model.
- `$schema` and the four `metadata` fields are present and match the `TERMS` entry.
- Copy and Download exist; Download produces `<id>.calm.json`.
- Copy says "Copied" when the clipboard accepts the text and "Copy failed" when it refuses.
- The JSON block can be reached and scrolled by keyboard, and has an accessible name.
- Nothing overflows the viewport when it is open.
- An open disclosure prints its JSON whole, not clipped to the scroll box.
- The counts line matches the model, and leaves the flow out when there is none.

Existing checks (a) and (b) learn the new shapes: `shape-cyl` and `shape-doc` count as
boxes for label clearance, and their outlines are excluded from the stroke/text collision
check.

`verify.mjs --calm-out=<dir>` saves each term's download to `<dir>/<id>.calm.json`, so the
official CLI validates exactly what a reader would download.

### Fixtures

`test/calm-fixtures.mjs`, run by `npm run test:calm`, in the pattern of the tour and
takeaway suites. It plants each defect in a copy of `index.html` and asserts the named
check reports it:

- `validate.mjs`: a model for an unknown term id; a node with no `description`; a
  relationship naming a missing node; a transition naming a missing relationship; a
  duplicated `unique-id`.
- `verify.mjs --offline`: a node that is not drawn; a drawn title that differs from
  `name`; a database drawn as a plain box; a connector tagged with an unknown
  relationship; a connector ending on the wrong node; a child outside its container; an
  untagged box; a flow whose order contradicts the tour.
- `verify.mjs --offline`, rule `calm-type`: a node whose box is too small for a clear
  corner in any font, so the result does not depend on the fallback font the offline run
  measures in; a node whose corners are all blocked by one-character labels, one of them
  starting about 2 units past the word's fixed right end, which reports "sits N units
  beside" rather than an overlap; and a page whose labelling is disabled, which reports
  "no type word".

The fixtures are written before the checks, so each check is seen to fail first.

`test/tour-fixtures.mjs` replaces the WireGuard diagram wholesale, so it gains a matching
synthetic model and `data-calm` tags; otherwise its good case would fail check (e) once
WireGuard has a real model.

### Official cross-check

FINOS's `calm validate` CLI (`@finos/calm-cli`, run through `npx`, not installed in the
repo) validates the files from `--calm-out`: the five pilots, then all 105 at lock-in.

Confirmed on this machine on 6 October 2026 with `@finos/calm-cli` 1.60.1 on Node 24.15:
`npx --yes @finos/calm-cli@1.60.1 validate -a <file>` accepts an architecture whose
`$schema` is the URL above, exits 0 with `hasErrors` and `hasWarnings` false, and exits 1
on a missing node description, a relationship naming a missing node, or a transition
naming a missing relationship. It warns about a node no relationship names.

### Reading the result

The geometry and mapping checks do not judge whether a drawing is right. Light and dark
element screenshots of `#detail-content` are read for every redrawn diagram.

### Docs

- `CLAUDE.md`: the `CALM` map in the file description, a new invariant (every term has a
  CALM model and its diagram matches it), and `npm run test:calm` under Verification.
- `add-glossary-term` skill: a step for writing the model, the grammar additions (the two
  shape helpers, `data-calm`, `data-note`), and check (e) in the verify step.
- `README.md`: one sentence on the models and the download.

## 5. Rollout

- **Phase 1, foundation.** Vendored schema and `ajv`; `extractObject`; the `validate.mjs`
  checks; the two shape helpers and their CSS; `calmHtml` and its behaviour; verify check
  (e) and `--calm-out`; `test/calm-fixtures.mjs`. During the migration a term without a
  model renders as it does today, shows no disclosure, and is skipped by check (e).
  Three commits, one per reviewable piece: the model checks in `validate.mjs`, the
  drawing grammar with check (e), and the disclosure. A `docs:` commit then adds the
  model step to the skill, so the pilot and the batches can follow it.
- **Phase 2, pilots.** DNS (a flow with replies), Kubernetes (`deployed-in` containment),
  OAuth (an actor and a multi-party sequence), JWT (`composed-of` anatomy with no flow),
  OWASP (the stretch case). Commit:
  `feat: redraw the pilot diagrams to their CALM models`. Stop for review with light and
  dark screenshots, the five JSON files, the official CLI result, the measured growth of
  `index.html`, and any change the pilots suggest to this spec.
- **Phase 3, the other 100.** Eleven batches by first-listed domain. Identity & Access is
  split in two and the two Kubernetes-first terms join Platforms & Apps:

  | Batch | Terms |
  |---|---|
  | Addressing & Routing (5) | tcpip bgp vlan nat dhcp |
  | Transport & Web (15) | http grpc mqtt quic cors websockets webtransport websec pac alpaca cntlm envoy http2 fix har |
  | Secure Channels & Crypto (11) | tls vpn wireguard ssh ipsec mtls pki vault pqc tailscale tpm |
  | Identity & Access, part 1 (10) | saml radius spiffe idp pkce oidc scim mfa rbac ldap |
  | Identity & Access, part 2 (9) | kerberos pam bola obo paseto cyberark fapi fido2 immuta |
  | Zero-Trust Core (9) | zerotrust microseg peppdp openziti opa servicemesh nist207 ztna istio |
  | Network Edge & Ops (14) | firewall loadbalancer sase sdwan waf apigateway casb dpu bluefield supernic ovs ovn ndlp sbc |
  | Platforms & Apps, with Kubernetes (9) | docker react django doca keda ebpf amps cilium calico |
  | Detection & Response (6) | siem edr idsips soar dlp sentrywire |
  | Governance & Supply Chain (5) | sbom cve sigstore spinnaker dora |
  | AI & Models (7) | rlhf dpo rag lora qlora coreweave jev |

  Per batch: models, redraws, `npm test`, `npm run verify <ids>`, screenshots read. One
  commit per batch: `feat: redraw the <domain> diagrams to their CALM models`. Each batch
  summary lists reworded captions or steps, every `data-note`, and every term whose model
  is a stretch.
- **Phase 4, lock-in.** Make a model mandatory in `validate.mjs` and `verify.mjs` and
  remove the no-model fallback. Run the official CLI over all 105, a full `npm run verify`,
  and the three fixture suites. Update `CLAUDE.md`, the skill, the README, the hero lede
  and the meta description in a `docs:` commit. Refresh the six committed screenshots in
  `chore: refresh screenshots after the CALM redraw`.

Push only when James asks.

## Out of scope

- CALM controls, interfaces, `options`, patterns, decorators, timelines and ADR links.
- Generating diagrams from models, or any layout engine.
- A CALM glossary entry. It would be a separate term through the usual skill.
- Schema validation in the page at runtime, and any link between hovering the JSON and
  the drawing.
- Publishing models to CALM Hub.
- Changes to explainers, takeaways, sources, tags, `glossary.txt`, the browse grid,
  filters or TOC.
- Splitting `index.html`, a build step, or a runtime dependency.

## Risks

- **Volume:** 105 models and 105 redraws across several sessions. The pilot gate settles
  the rules before the volume, and the batches make the work resumable.
- **Stretch models:** a ranked list or a matrix sum modelled as nodes is valid CALM of
  little use to a CALM tool. Each batch names them. No exemption mechanism is built up
  front; if James overrules a model, what replaces it is decided then.
- **Custom node types:** valid in 1.2, but CALM tools may render them generically.
- **Protocol list:** most protocols in this glossary are absent from CALM's twelve, so the
  `protocol` field will be rare and descriptions carry the name.
- **Endpoint tolerance:** the connector-ends check can misfire on elbows, lifelines and
  container borders. The pilots tune the tolerance; a check that needs per-diagram
  exceptions is a sign the rule is wrong.
- **Overlapping connectors:** redrawing a shared trunk as separate lines may look heavier
  or animate oddly where they overlap. Kubernetes and OAuth in the pilot show whether it
  reads well.
- **Schema drift:** CALM went from 1.0 to 1.2 quickly. The models pin 1.2 and the vendored
  copy is dated; moving to a later release is a separate change.
- **File size:** an estimated 250 KB on top of 750 KB. Measured after the pilots.
- **Hook dependency:** `validate.mjs` stops being dependency-free.
- **Fonts:** a real `verify` run still needs Google Fonts, as today.
