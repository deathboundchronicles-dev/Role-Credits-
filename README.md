# Role Credits Studio

Offline character, campaign, and homebrew tools for Windows, Android, and a standalone HTML file. The current release is **[v0.2.6.0](https://github.com/deathboundchronicles-dev/Role-Credits-/releases/tag/v0.2.6.0)**. Never replace existing v0.2.5.0 release assets.

## One shared app

`index.html` is the canonical game UI. Modules in `app/` are bundled by `node scripts/sync-app.mjs`, which also generates byte-identical copies at `Role_Credits_Studio_Standalone.html` and `android/app/src/main/assets/index.html`. All three files are self-contained and work offline. Commit the generated copies. `node scripts/sync-app.mjs --check` and `python release/check_release.py` reject mismatches.

The Windows launcher embeds the standalone copy and retains `http://127.0.0.1:38471` as its storage origin. Android retains its application ID, appassets origin, and permanent signing-key configuration. Moving the standalone file or changing browsers may use different storage; use campaign backups to transfer live data.

## Homebrew Library

Open **Build & Workshop → Creation → Homebrew Library**. Search names, Tags, and rules text; filter by type, category, or collection; select items and save named collections. Supported types include Cliques, Backgrounds, Techniques, Equipment, Team Assets, Threats, Adventures, Missions, Scenes, Crises, Situations, Obstacles, Catastrophes, and custom Tags. The snapshot menu captures the active character, character build draft, team, or earned Signature Moves as separate library copies.

Export one item, a selection, a collection, or the entire library. Linked designs are included by default; disable the checkbox for an exact selection. **Share Pack** uses file sharing where supported and otherwise downloads JSON. Android uses its native save-location picker. No online service is required.

Imports preview incoming data before writing. Matching IDs or normalized names require **skip**, **keep both**, or an explicitly selected **replace** target. Keep-both changes the ID/name and remaps links within the pack. Collection conflicts produce named copies shown in preview. Duplicate IDs inside a file are rejected as ambiguous; fix source IDs or export separate packs. Missing links produce warnings. Import validation is structural; builders retain responsibility for mechanical rules.

Library imports update only the current campaign's reusable library, preserving live characters, teams, scenes, drafts, and other campaign profiles. Snapshots are not automatically installed into sheets. The main campaign importer recognizes Homebrew packs and routes them to library preview.

Download library backups for safekeeping. A recovery backup is also saved before library management writes, separately for each campaign or Free Agent workspace. **Recover Last Local Backup** offers a reviewed merge or **Preview Exact Library Restore**, which lists the replacement and removed items before confirmation. Exact restore changes only that library. Failed writes roll back the library and persisted campaign records. Regular **Export JSON** campaign backups include live players and all profiles.

## Portable JSON

Packs use `format: "RoleCreditsHomebrew"`, `schemaVersion: 2`, a `name`, typed `items: [{type, data}]`, and optional `collections: [{id, name, members: [{type, id}]}]`. Backups carry `kind: "backup"`. Item extension fields are retained. Unknown types/future schemas are rejected. Schema 1 and legacy libraries, including the library portion of Studio V2 exports, migrate through preview.

Limits: 18 MB, 5,000 items, 500 collections, and 30 JSON nesting levels. Invalid shapes, numeric fields, unsafe IDs/properties, ambiguous IDs, and malformed objectives are rejected before storage changes. Captured snapshots may contain portraits and personal fiction; preview before sharing.

## Development and checks

Use Node 22+, pnpm 11.25.0, Python 3, and Go 1.23+:

```
pnpm install --frozen-lockfile
node scripts/sync-app.mjs
pnpm test
pnpm exec playwright install chromium
pnpm test:browser
go test ./...
python release/check_release.py
```

Browser tests run offline in desktop, Android phone, and tablet touch viewports. They check typing/node identity/caret/composition, saving and reload, dropdown scrolling, ten builder suites, file round trips, collections, conflict preview, exact restore, failed-storage rollback, campaign preservation, and imported-item editing. Evidence goes to `test-results/`. Set `RC_BROWSER` to use an installed Chromium executable. `node tests/reproduce-input.cjs` reproduces the original bug from the untouched v0.2.5.0 tag.

Build Windows with `scripts/build-windows.ps1`, optionally supplying `-GoExecutable` and `-PythonExecutable`. Outputs/checksums go to `dist/v<version>/`, leaving older root binaries intact. Windows installers have no Authenticode signature.

## Releases

`release/VERSION` controls Android versionName/versionCode and coordinated builds. Keep the default Windows version in `main.go` aligned. Pushing a changed version file to `main` starts the **Unified Release** workflow as a prerelease; it can also be run manually. It runs shared regressions, builds both platforms from one commit, verifies Android signing, and publishes Windows, Android, standalone HTML, and checksums together. Existing tags are refused. Separate Windows/Android workflows produce artifacts only, avoiding competing partial releases.

Signed Android builds require `RC_ANDROID_KEYSTORE_BASE64`, `RC_ANDROID_STORE_PASSWORD`, `RC_ANDROID_KEY_ALIAS`, and `RC_ANDROID_KEY_PASSWORD` repository secrets. Missing signing material is an explicit failure, never a debug-key fallback. Touch viewport tests do not prove physical Android keyboard/WebView behavior; check devices and same-certificate upgrade retention before calling a release device-verified.
