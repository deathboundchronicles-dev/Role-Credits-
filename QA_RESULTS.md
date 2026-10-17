# Role Credits v0.2.5.0 Unified Release: Pre-Publication QA

## PASS, locally verified

- GitHub live audit established latest existing Windows-only v0.2.2.6 and Android-only v0.2.4.6 releases, and a working Android permanent signing workflow.
- `release/VERSION` = `0.2.5.0`; Android generated versionCode expected = `20500`, greater than installed release v0.2.4.6 / 20406.
- Root Windows game HTML is byte-identical to v0.2.4.6 Android's current embedded game HTML, including its guarded native backup bridge. Shared SHA-256: `bf1d55b8c088effa429f97acdc28622d4161105fce7aaa1cb1252893f1d27ebb`.
- Parsed all three GitHub workflow YAML documents successfully and Bash-syntax checked each Bash execution step (`bash -n`).
- Ran `release/check_release.py` in an assembled file fixture; success for 0.2.5.0, deliberately rejects mismatching version and game HTML.
- Using v0.2.4.5 packaged desktop Go source with unified HTML: `go test ./...` passed.
- Cross-compiled Windows GUI x64 PE32+ launcher with Go linker version 0.2.5.0; verified PE file and version bytes.
- Embedded canonical branded icon in compiled Windows launcher; icon resource tree includes eight icon sizes and RT_GROUP_ICON. Resource parser verified.
- Both signed Android secret names and filenames match proven v0.2.4.6 release pipeline; no secrets included in package.

## PENDING, requires GitHub Actions and device

- Test the new Android `release/VERSION`-derived Gradle configuration on the hosted Android SDK (SDK unavailable in local environment).
- Execute `Role Credits Unified Release (Windows + Android)` workflow using the committed source and existing private GitHub Actions signing secrets.
- Verify five published assets under one v0.2.5.0 GitHub release.
- On existing signed Android v0.2.4.6, use the **⋮ → Check for Android updates** flow and confirm in-place upgrade with campaign persistence.
- On Windows, test `Check for Updates` from installed desktop app and verify upgrade/icon persistence.

## Known limitation

Windows SHA-256 checksum protects transfer integrity but no Authenticode publisher certificate is configured. Do not describe the Windows EXE as publisher-signed. Android signed APK uses the permanent pre-existing certificate stored only in GitHub Actions secrets.
