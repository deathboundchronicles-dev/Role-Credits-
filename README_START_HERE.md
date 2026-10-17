# Role Credits Studio Android updater: v0.2.4.6

## What is included

- Unmodified v0.2.4.5 game UI / dice engine, packaged in the v0.2.4.6 Android shell.
- Android app version 0.2.4.6 (versionCode 20406), package `media.rolecredits.studio`.
- In-app update button and once-daily background checks of GitHub Releases.
- Explicit acceptance before download; SHA-256 checksum verification; APK package name, version and certificate checks; Android system installer for user authorization.
- A private read-only content provider to hand staged APKs to Android's installer.
- The same approved RC icon and existing campaign import/export / native portrait picker.
- GitHub Actions: debug checks on pushes, permanently signed release on explicit manual publish.

## Before replacing your installed v0.2.4.5 debug APK

1. On your phone open Role Credits Studio -> three-dot app menu -> Export campaign backup.
2. Save the JSON file outside the app, ideally to cloud storage AND another location. Verify the file exists and is nonempty.
3. Do NOT uninstall the debug build yet. First complete GitHub upload, configure the four private signing secrets and run the signed build successfully.
4. Only after the signed APK appears in GitHub Releases, uninstall the debug-signed app, install the permanently signed APK, then choose Import campaign backup.
5. Verify your saved characters, portraits, campaigns and dice settings. Keep the JSON backup safe.

Android cannot update an APK signed by GitHub's temporary debug signing key with one signed by a new permanent release key. The one-time uninstall is unavoidable. Subsequent Android releases MUST use the same private signing key and increment versionCode and versionName.

## Put updater source into GitHub

On your Windows laptop use GitHub Desktop (recommended): open/clone
https://github.com/deathboundchronicles-dev/Role-Credits- ; choose Repository -> Show in Explorer.
Copy ONLY the `android/` folder and `.github/workflows/android-apk.yml` from this ZIP into the repository root, merging/replacing files. The existing desktop workflow must remain untouched. Commit and push to `main`.

Do NOT upload your private signing kit, .p12 file, keystore passwords, or private key into the public repository, even to a private branch.

## Configure signing secrets

Use the companion, SEPARATE `Role_Credits_Android_Permanent_Signing_Kit_PRIVATE.zip`. Open its `SIGNING_SECRETS_KEEP_PRIVATE.txt` locally. In GitHub:
Settings -> Secrets and variables -> Actions -> New repository secret
and create each of the four keys exactly as listed. The `RC_ANDROID_KEYSTORE_BASE64` value is a LONG single-line base64 string. Do not include surrounding quotes.
Keep an encrypted offline backup of `rolecredits-permanent-signing.p12` and its password. Anyone with both can impersonate your Android APK; loss of the key prevents seamless updates.

## Build and publish

Go to Actions -> Role Credits Android APK -> Run workflow -> tick **publish_signed_release** -> Run workflow. Once the run succeeds, open your GitHub Releases page:
https://github.com/deathboundchronicles-dev/Role-Credits-/releases
Download `Role_Credits_Android.apk` (NOT `app-debug.apk`), transfer/install it on your phone, and restore your exported campaign JSON. There may be an 'Install unknown apps' permission for the browser/file manager.

## Later Android updates

Change `versionName` and `versionCode` in `android/app/build.gradle`; update About text in MainActivity.java; bump to the NEXT version. Keep the package name and signing secrets unchanged. Publish the updated signed APK and `.sha256` assets under the matching `v<versionName>` GitHub release. The app's menu -> Check for Android updates will download and validate the update and open the Android installer. Data persists in same-signer installs.

## Caveats

GitHub Actions was successfully building v0.2.4.5 debug APKs before this patch. This updated Java code and the permanent-signing/release workflow have NOT yet compiled or run on GitHub; compilation and phone behavior need live verification. This environment has no Android SDK. Do not uninstall until the signed build succeeds and you have your verified backup.
