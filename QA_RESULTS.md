# Role Credits Android Updater v0.2.4.6, QA

- [x] Android XML manifest parses correctly; install permission and private APK content provider configured.
- [x] Android Java syntax checked using JDK compiler parser (MainActivity, MobileUpdater, UpdateApkProvider): 3/3 pass.
- [x] The game HTML is byte-for-byte identical to the previously bundled v0.2.4.5 engine; no game mechanics modified.
- [x] Official icon and branded resources carried over unchanged.
- [x] Signing keystore contains a long-lived RSA 3072-bit PKCS#12 private-key entry, alias `rolecredits`, verified with keytool.
- [x] Signing material excluded from the public source ZIP and only included in the separately marked private kit.
- [x] YAML syntax parses; versionCode 20406 and versionName 0.2.4.6 present; SDK 35 and Gradle build steps match previously successful debug configuration.
- [x] GitHub release file naming and `.sha256` verification logic match.
- [ ] Actual Android Java compilation and APK signing have not run in this container (no Android SDK and no network download available).
- [ ] Android device install, backup/restore, and automatic updates require user testing after GitHub build.
- [ ] Source cannot be pushed from this connector due GitHub 403 write restrictions. User must upload via GitHub Desktop.

Safety: Never uninstall the existing debug APK before exporting/confirming a valid backup and producing a signed APK. Don't upload the permanent signing key or any of its secrets to the public repository.
