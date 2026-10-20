# v0.2.6.0 verification

Verified locally on Windows with Microsoft Edge through Playwright. The Android and tablet runs use touch viewports, Android user agents, and device pixel ratios; they do not run the native Android WebView or a physical keyboard.

## Results

- Reproduced the original v0.2.5.0 bug from its untouched Git tag: typing `Typing test` saved only `T`; the input node was disconnected and focus was lost. Evidence: `test-results/baseline-reproduction.json`.
- Seven Node test groups pass: every supported asset type round-trips, ID/name conflicts require choices, copied links and collections remap, exports include transitive dependencies, legacy schemas migrate, malformed/future/unsafe inputs fail atomically, and same-name entries within a pack are reviewed.
- All browser checks pass at 1440×900 desktop, 393×851 Android phone, and 800×1024 Android tablet sizes. Each checks 20 editable fields across ten builder suites, stable node identity, caret insertion, textarea typing, composition, immediate persistence/reload, dropdown focus/scroll, JSON file import/export, Android save bridge handoff, filters/selections/collections, conflict preview, backup/exact restore, failed-storage rollback, and preservation of live character/team/scene/roster/campaign state.
- The main campaign importer routes Homebrew packs to preview. Imported Scenes open in the existing builder. No uncaught browser exceptions or horizontal overflow occurred. Browser evidence and screenshots: `test-results/browser-results.json` and `test-results/*-library.png`.
- Existing Windows updater tests pass (`go test ./...`) when allowed to open their temporary loopback test server.
- Release consistency checks pass: canonical, standalone, and Android asset HTML are byte-identical. Shared HTML SHA-256: `70f81c3dcedb68fe25faefc77d0f3c37c380db3752e672cb97b95c547feb3cbd`.
- Windows x64 installer and portable executable built with Go 1.27.3. Approved icon resources were embedded and structurally checked. Installer SHA-256: `64a30ae941740fa729654ede107d0725a8f2451108d6e9dd26bb6329e82e7a2a`. These are unsigned Windows binaries; a real installation/self-update handoff was not exercised.
- Outputs: `dist/v0.2.6.0/Role_Credits_Setup.exe`, `Role_Credits.exe`, `Role_Credits_Studio_Standalone.html`, and checksum files. Older root binaries and v0.2.5.0 GitHub release assets are untouched.

## Remaining delivery checks

- No permanent Android signing material is present locally, and no Android build was produced locally. The coordinated workflow requires the existing four signing secrets and compares the resulting certificate to the published v0.2.5.0 APK before publication.
- The GitHub workflow changes are prepared locally. No commit, push, workflow dispatch, or publication has occurred as part of this verification. GitHub execution must confirm the actual signed APK and downloadable release URLs.
- Real Android IME/keyboard behavior, system file-picker behavior, and same-certificate upgrade/data retention still need device testing. Browser tests verify only the shared HTML and the mocked native export handoff.
