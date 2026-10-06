# CALM 1.2 schema (vendored)

The eleven files of the FINOS Common Architecture Language Model release 1.2, copied
unmodified from
https://github.com/finos/architecture-as-code/tree/main/calm/release/1.2/meta
on 6 October 2026.

`_calm.mjs` validates every model in `index.html` against `core.json`, which refers to
`control.json`, `flow.json` and `interface.json`. The other files are kept so the copy is
the whole release. To move to a later release, vendor it beside this one, then change
`SCHEMA_DIR` and `CALM_SCHEMA` in `_calm.mjs` and the `$schema` URL in `index.html`.
