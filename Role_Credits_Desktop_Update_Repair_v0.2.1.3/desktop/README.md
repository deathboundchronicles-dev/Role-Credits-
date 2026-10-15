# Role Credits Studio Desktop (Windows)

This Windows launcher serves the embedded, audited Role Credits HTML entirely from `127.0.0.1:38471`. It retains the same localStorage origin across **this launcher family**, even after replacing the application executable.

## Install

Run `Role_Credits_Setup.exe` on Windows. It copies itself as `%LOCALAPPDATA%\Programs\Role Credits Studio\Role_Credits.exe`, adds a Start Menu shortcut, and launches the application. Keep a JSON export before switching from an older launcher: the **older** launcher's localhost port/origin has not been recovered, and browser storage does not automatically migrate between origins.

## Updates

The launcher checks `https://api.github.com/repos/deathboundchronicles-dev/Role-Credits-/releases?per_page=30` no more than once per 12 hours per running process, plus manual `Check for Updates`. It includes prereleases. It selects only releases newer than its embedded numeric version that contain **both** `Role_Credits_Setup.exe` and `Role_Credits_Setup.sha256`. It retrieves and checks SHA-256 before running the downloaded setup. A consent click is required; network and checksum failures do not touch the installed launcher.

`Role_Credits_Setup.exe` also supports `--install`. During a self-update, the old server process exits after handing off the verified installer; the setup retries replacing a still-running launcher, preserves its previous binary until replacement is staged, then relaunches. These mechanics are covered by unit tests for parsing/checker/HTML injection, but real Windows installation, process handoff and browser-origin behavior require testing on Windows.

**Important:** This source package alone does not publish a release. At the time of audit, GitHub Releases for the canonical repository was empty. Existing installed `0.2.1.2` updaters cannot find a new version until a GitHub Release is actually published with the required asset names and a higher version, e.g. `v0.2.1.3`.

## Build and tests

Run `go test ./...` from this folder. Build on any machine with Go 1.23+:

```
GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -trimpath -ldflags='-s -w -H windowsgui' -o Role_Credits_Setup.exe .
```

The application is embedded at compile time. When releasing changes, replace `Role_Credits_Studio_Standalone.html`, bump `appVersion`, and rebuild both installer and checksums. Never publish changed bytes under an existing version number.

## Known boundaries

- The preexisting Windows installed launcher and its private local files were not accessible during this audit. Compatibility with its exact install path/origin was not verified.
- Windows code signing (Authenticode) was not available. SHA-256 downloaded from the same GitHub Release protects against accidental corruption, not compromise of the GitHub account.
- Windows binary was cross-compiled and structurally checked on Linux; no Windows execution or SmartScreen behavior was verified.
- No release has been published automatically by producing this source/ZIP.
