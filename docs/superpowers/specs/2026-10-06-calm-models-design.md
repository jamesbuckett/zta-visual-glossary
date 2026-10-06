# CALM models behind every diagram — design

Date: 2026-10-06
Status: approved in brainstorming, awaiting spec review

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
- `name`: the title drawn in the node's shape, word for word. It fits one `<text>`
  element; a title that wraps today is shortened or its box widened.
- `description`: one sentence, stating only what the term's `explainer` says. UK spelling.

### Relationships

| Type | Used for |
|---|---|
| `connects` | A directed link between two nodes, `source` to `destination` |
| `interacts` | An `actor` node and the nodes it uses |
| `deployed-in` | A node that runs inside another: a pod in a worker node |
| `composed-of` | A node that is a part of another: a header in a token |

- `protocol` appears only when CALM's list has the protocol. Otherwise the relationship's
  `description` names it.
- A request and its reply are one relationship. The reply is a flow transition with
  `direction: "destination-to-source"`, not a second relationship.
- A node is a container through `deployed-in` or through `composed-of`, never both.
- `options` is not used.

### Flows

A model has one flow when at least one tour step lights a connector, and none otherwise
(JWT's anatomy tour lights parts, not connectors). The flow mirrors the tour:

- Transitions appear in the order the tour lights their connectors.
- `sequence-number` runs 1 to N with no gaps or repeats.
- Each transition has its own drawn connector, drawn in the transition's direction.
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
| `actor`, `webclient` | Rounded box, `rx="12"` | Today's convention |
| `service`, `system`, custom types | Square-cornered box, `rx="8"` | Today's convention |
| `database`, `ldap` | Cylinder | New |
| `data-asset` | Document with a folded corner | New |
| `network`, `ecosystem`, and any node that contains others | Zone | Today's zone |

A node that contains others is drawn as a container whatever its type. Two helpers join
`icon()` and `badge()` and emit the new outlines: `<path class="box shape-cyl">` and
`<path class="box shape-doc">`, each with an accent variant on `box-accent`.

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
  illustrative mark, such as a mapping-table cell or the struck-through X, opts out with
  `data-note="<short reason>"` on itself or its group.
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
  <p class="calm-key">Rounded box: actor or client. Square box: service or system.
     Cylinder: data store. Folded document: data asset. Dashed zone: deployed in.
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

## 4. Tooling and verification

### `_terms.mjs`

`extractObject(html, name)` walks `const CALM = {` to its matching brace, as
`extractArray` does for brackets, and evaluates the literal in a bare context.
`readTerms` returns `CALM`, an empty object if the declaration is absent.

### `validate.mjs` (`npm test`)

- `CALM` parses. A failure is a `data-parse` error like the existing ones.
- Every `CALM` key is a term id. After lock-in, every term id has a model.
- Each stored model validates against CALM 1.2 `core.json`. The eleven schema files under
  `calm/release/1.2/meta/` are vendored into `test/calm-schema/1.2/`, with a README giving
  the source URL and the date fetched. `ajv` (2020-12 dialect) is a new devDependency.
- Reference checks the schema cannot express:
  - node ids are unique, and relationship ids are unique
  - every node a relationship names exists
  - no node contains itself, and no node is a container through both `deployed-in` and
    `composed-of`
  - every relationship a transition names exists
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
  `destination-to-source` transition on that relationship.
- Every child of a `deployed-in` or `composed-of` relationship sits inside its container,
  and the container's border is dashed or solid to match.
- Walking the flow's transitions in sequence order, each has its own connector in the
  transition's direction, and the tour step that first lights those connectors never
  decreases.
- Every `box*` and `zone*` element is inside a node's group or covered by a `data-note`,
  and every `flow*` element carries `data-calm` or `data-note`. Every `data-calm` value
  names a node or relationship in the model.

The disclosure, at 1440px and 375px:

- It is present, closed by default, and stays closed for print.
- Its JSON parses, and its `nodes`, `relationships` and `flows` equal the stored model.
- `$schema` and the four `metadata` fields are present and match the `TERMS` entry.
- Copy and Download exist; Download produces `<id>.calm.json`.
- Nothing overflows the viewport when it is open.

Existing checks (a) and (b) learn the new shapes: `shape-cyl` and `shape-doc` count as
boxes for label clearance, and their outlines are excluded from the stroke/text collision
check.

`verify.mjs --calm-out <dir>` writes each disclosure's JSON to `<dir>/<id>.calm.json`, so
the official CLI validates exactly what a reader would download.

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

The fixtures are written before the checks, so each check is seen to fail first.

### Official cross-check

FINOS's `calm validate` CLI (`@finos/calm-cli`, run through `npx`, not installed in the
repo) validates the files from `--calm-out`: the five pilots, then all 105 at lock-in. Its
exact invocation, and whether it runs on this machine at all, is settled in the pilot. If
it cannot run here, `ajv` is the only schema validation and the pilot summary says so.

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
  Commit: `feat: add CALM model support to the glossary tooling`.
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
- **The official CLI:** not yet run on this machine. Its pilot run also confirms the
  `$schema` URL the page adds; if the CLI expects a different one, this spec is corrected
  before the batches start.
- **File size:** an estimated 250 KB on top of 750 KB. Measured after the pilots.
- **Hook dependency:** `validate.mjs` stops being dependency-free.
- **Fonts:** a real `verify` run still needs Google Fonts, as today.
