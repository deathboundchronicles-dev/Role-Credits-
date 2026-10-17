## Role Credits Studio v0.2.5.0

**One release, two platforms.** This cross-platform release unifies the desktop and Android distribution channels with one shared version and identical underlying Role Credits game HTML.

### Windows
- Signed-checksum Windows x64 installer with the existing in-app GitHub update mechanism.
- Approved Role Credits branded icon embedded in the Windows executable.
- Offline character sheets, campaigns, rosters, dice and Token mechanics.

### Android
- Permanently signed Android APK, compatible with the existing v0.2.4.6 production signing key.
- Native campaign backups, file picker, physical dice, and manual/automatic signed update checks.
- Android's own install-confirmation screen, verified APK checksum and matching app signing certificate.

### Distribution
- Both installers are built from a single commit and published together to one GitHub Releases entry, alongside independent SHA-256 checksums.
- Back up campaign JSON before upgrading, particularly when changing devices. Same-signature Android updates should preserve local data.

**Note:** The Android release is signed by the permanent Role Credits certificate. The Windows checksum verifies download integrity but is not an Authenticode publisher certificate; Windows may show an unrecognized-publisher warning.
