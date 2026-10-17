# Role Credits Studio: One-Click Cross-Platform Releases

**First coordinated release: v0.2.5.0**

This is an **overlay patch** for the existing public GitHub repository `deathboundchronicles-dev/Role-Credits-`. It does not include the full game source, Android signing keys, or an APK; both platform installers will be built by GitHub Actions from the existing repository.

## One-time setup

1. Using **GitHub Desktop**, open your existing Role-Credits- repository clone.
2. Extract this archive and **copy its contents into the repository root**, preserving the `.github`, `android` and `release` directories. Replace the older files when prompted. Do not place the containing folder inside your repository.
3. GitHub Desktop should show updates to the two existing workflows, one **new** `.github/workflows/cross-platform-release.yml`, Android Gradle config, Android MainActivity, the root game HTML, and `release/` configuration files. No signing key should appear in the changes.
4. Commit and **Push origin** to main. Automated **Windows Checks (CI)** and **Android Checks (CI)** should run; they do **not** publish installers.
5. Open https://github.com/deathboundchronicles-dev/Role-Credits-/actions/workflows/cross-platform-release.yml
6. Click **Run workflow**; version `0.2.5.0`; channel `prerelease`. Run.
7. Wait for green checks on Verify, Windows, Android, Publish. GitHub will create **one** v0.2.5.0 release with both installers and checksum files:

   - `Role_Credits_Setup.exe` (Windows installer/updater)
   - `Role_Credits_Setup.sha256` (Windows SHA-256)
   - `Role_Credits.exe` (Windows alternate launcher name)
   - `Role_Credits_Android.apk` (signed Android installer/updater)
   - `Role_Credits_Android.sha256` (Android SHA-256)

8. On Android v0.2.4.6, use the app's top **⋮ → Check for Android updates** to verify it offers v0.2.5.0. **Do not uninstall** the permanently signed v0.2.4.6 app. The update must install over it, preserving campaign data.
9. On Windows, use its in-app update checker or install `Role_Credits_Setup.exe`. Windows releases remain unsigned at the publisher-certificate level; ensure you download from the official GitHub release.

## Important reliability guarantees

- A release is published only after both jobs pass, and starts as a draft until all five assets are present. Drafts are invisible to the automatic updaters.
- The existing four `RC_ANDROID_*` GitHub Actions secrets are reused; never store the private signing kit in the repository.
- The previous Windows workflow no longer publishes older Windows-only versions every time source changes. The Android workflow no longer makes Android-only versions. Both remain quick CI checks.
- Both platforms use the same `Role_Credits_Studio_Standalone.html` game content; `release/check_release.py` enforces byte equality with the Android embedded `index.html`.
- There is **one** authoritative `release/VERSION` string. Android calculates its versionName and monotonic versionCode from it, and Windows receives that version through Go linker flags.
- Re-running an already-published version deliberately fails. Change the version first. Do not overwrite existing release assets after publishing; that would invalidate download integrity expectations.

## Every subsequent release

1. Make game changes in `android/app/src/main/assets/index.html`, then **copy the exact same HTML bytes** to `Role_Credits_Studio_Standalone.html`. Or make changes in root HTML, then copy it the other way. They must match before releasing.
2. Edit `release/VERSION`, e.g. `0.2.5.1`, and keep each component after major below 100.
3. Edit `release/RELEASE_NOTES.md` for the new version.
4. Commit + push. Trigger **Role Credits Unified Release** with the new version.

## Troubleshooting

- If `Check release sources` fails, the source HTMLs differ or version is mismatched. Do not deploy until resolved.
- If `android` fails at signing, verify the same four secrets used to sign v0.2.4.6 still exist and haven't changed.
- If a draft release gets created but publication fails, it will remain invisible to updaters. Inspect and fix before considering the release valid; don't overwrite signed public assets.
- A GitHub Actions artifact with `Debug` in the name is not the published signed Android installer.
- Protect and back up your permanent signing `.p12` file and its passwords offline: if they are lost, future Android updates cannot preserve the app identity.

## Windows note

The Windows PE icon is **embedded** by the existing `embed_windows_icon.py` script, matching the approved branded icon. No Windows Authenticode signing certificate is included in this workflow; Windows SmartScreen may warn until one is arranged.
