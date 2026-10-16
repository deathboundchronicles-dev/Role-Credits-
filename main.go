package main

import (
	"context"
	"crypto/sha256"
	"embed"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"
)

//go:embed Role_Credits_Studio_Standalone.html
var appHTML embed.FS

//go:embed Role_Credits.ico
var applicationIcon []byte

const (
	appName        = "Role Credits Studio"
	releaseAPI     = "https://api.github.com/repos/deathboundchronicles-dev/Role-Credits-/releases?per_page=30"
	assetInstaller = "Role_Credits_Setup.exe"
	assetChecksum  = "Role_Credits_Setup.sha256"
	// Fixed across future versions to keep localStorage origin stable.
	port = "38471"
)

var appVersion = "0.2.2.6" // overridden by -ldflags for releases

var httpClient = &http.Client{Timeout: 30 * time.Second, CheckRedirect: func(r *http.Request, via []*http.Request) error {
	if len(via) > 8 || r.URL.Scheme != "https" {
		return errors.New("unsafe download redirect")
	}
	return nil
}}

type asset struct {
	Name string `json:"name"`
	URL  string `json:"browser_download_url"`
	Size int64  `json:"size"`
}
type release struct {
	Tag        string  `json:"tag_name"`
	Draft      bool    `json:"draft"`
	Prerelease bool    `json:"prerelease"`
	Assets     []asset `json:"assets"`
}
type releaseCandidate struct {
	Version    string
	Setup, SHA asset
}
type updateState struct {
	mu          sync.Mutex
	checked     time.Time
	candidate   *releaseCandidate
	err         string
	downloading bool
}

var updater updateState

func numericVersion(s string) ([]int, error) {
	s = strings.TrimSpace(strings.TrimPrefix(strings.TrimPrefix(s, "desktop-v"), "v"))
	if !regexp.MustCompile(`^\d+(?:\.\d+){2,3}$`).MatchString(s) {
		return nil, errors.New("invalid version: " + s)
	}
	parts := strings.Split(s, ".")
	out := make([]int, 4)
	for i, p := range parts {
		n, e := strconv.Atoi(p)
		if e != nil {
			return nil, e
		}
		out[i] = n
	}
	return out, nil
}
func newer(candidate, current string) bool {
	a, e1 := numericVersion(candidate)
	b, e2 := numericVersion(current)
	if e1 != nil || e2 != nil {
		return false
	}
	for i := 0; i < len(a); i++ {
		if a[i] != b[i] {
			return a[i] > b[i]
		}
	}
	return false
}
func bestRelease(releases []release, current string) *releaseCandidate {
	var best *releaseCandidate
	for _, r := range releases {
		if r.Draft || !newer(r.Tag, current) {
			continue
		}
		c := releaseCandidate{Version: r.Tag}
		for _, a := range r.Assets {
			if a.Name == assetInstaller {
				c.Setup = a
			}
			if a.Name == assetChecksum {
				c.SHA = a
			}
		}
		if c.Setup.URL == "" || c.SHA.URL == "" || c.Setup.Size <= 0 {
			continue
		}
		if best == nil || newer(c.Version, best.Version) {
			copy := c
			best = &copy
		}
	}
	return best
}
func fetchReleases(ctx context.Context) ([]release, error) {
	request, e := http.NewRequestWithContext(ctx, "GET", releaseAPI, nil)
	if e != nil {
		return nil, e
	}
	request.Header.Set("User-Agent", "RoleCreditsStudio/"+appVersion)
	request.Header.Set("Accept", "application/vnd.github+json")
	resp, e := httpClient.Do(request)
	if e != nil {
		return nil, e
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("GitHub Releases returned %d", resp.StatusCode)
	}
	var out []release
	e = json.NewDecoder(io.LimitReader(resp.Body, 3<<20)).Decode(&out)
	return out, e
}
func checkUpdates(force bool) map[string]any {
	updater.mu.Lock()
	if updater.downloading {
		updater.mu.Unlock()
		return map[string]any{"status": "installing"}
	}
	if !force && time.Since(updater.checked) < 12*time.Hour && !updater.checked.IsZero() {
		c, msg := updater.candidate, updater.err
		updater.mu.Unlock()
		if msg != "" {
			return map[string]any{"status": "error", "message": msg, "current": appVersion}
		}
		if c != nil {
			return map[string]any{"status": "available", "version": c.Version, "current": appVersion}
		}
		return map[string]any{"status": "current", "current": appVersion}
	}
	updater.mu.Unlock()
	ctx, cancel := context.WithTimeout(context.Background(), 35*time.Second)
	defer cancel()
	releases, e := fetchReleases(ctx)
	updater.mu.Lock()
	defer updater.mu.Unlock()
	updater.checked = time.Now()
	updater.candidate = nil
	updater.err = ""
	if e != nil {
		updater.err = e.Error()
		return map[string]any{"status": "error", "message": e.Error(), "current": appVersion}
	}
	updater.candidate = bestRelease(releases, appVersion)
	if updater.candidate == nil {
		return map[string]any{"status": "current", "current": appVersion}
	}
	return map[string]any{"status": "available", "version": updater.candidate.Version, "current": appVersion}
}
func extractDigest(text string) (string, error) {
	s := strings.TrimSpace(text)
	// Accept `sha256  filename`, `SHA256(filename)= digest`, or bare digest.
	pat := regexp.MustCompile(`(?i)\b[a-f0-9]{64}\b`)
	match := pat.FindString(s)
	if match == "" {
		return "", errors.New("checksum asset must contain a SHA-256 digest")
	}
	return strings.ToLower(match), nil
}
func getHTTPS(ctx context.Context, url string, max int64) ([]byte, error) {
	if !strings.HasPrefix(strings.ToLower(url), "https://") {
		return nil, errors.New("download must use HTTPS")
	}
	req, e := http.NewRequestWithContext(ctx, "GET", url, nil)
	if e != nil {
		return nil, e
	}
	req.Header.Set("User-Agent", "RoleCreditsStudio/"+appVersion)
	resp, e := httpClient.Do(req)
	if e != nil {
		return nil, e
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("download returned HTTP %d", resp.StatusCode)
	}
	body, e := io.ReadAll(io.LimitReader(resp.Body, max+1))
	if e != nil {
		return nil, e
	}
	if int64(len(body)) > max {
		return nil, errors.New("release asset too large")
	}
	return body, nil
}
func verifiedInstaller(ctx context.Context, c releaseCandidate) (string, error) {
	digestBytes, e := getHTTPS(ctx, c.SHA.URL, 4096)
	if e != nil {
		return "", fmt.Errorf("checksum fetch: %w", e)
	}
	expected, e := extractDigest(string(digestBytes))
	if e != nil {
		return "", e
	}
	// Upper bound protects users from unexpected large downloads.
	data, e := getHTTPS(ctx, c.Setup.URL, 250<<20)
	if e != nil {
		return "", fmt.Errorf("installer fetch: %w", e)
	}
	if len(data) < 2 || string(data[:2]) != "MZ" {
		return "", errors.New("release installer is not a Windows executable")
	}
	h := sha256.Sum256(data)
	if got := hex.EncodeToString(h[:]); got != expected {
		return "", errors.New("installer SHA-256 mismatch; update aborted")
	}
	dir, e := os.MkdirTemp("", "role-credits-update-")
	if e != nil {
		return "", e
	}
	name := filepath.Join(dir, assetInstaller)
	if e = os.WriteFile(name, data, 0700); e != nil {
		os.RemoveAll(dir)
		return "", e
	}
	return name, nil
}
func appInstallDir() string {
	root := os.Getenv("LOCALAPPDATA")
	if root == "" {
		root = os.TempDir()
	}
	return filepath.Join(root, "Programs", "Role Credits Studio")
}
func installLocation() string { return filepath.Join(appInstallDir(), "Role_Credits.exe") }

// setupShortcuts creates both the Start Menu and the actual user Desktop shortcut,
// including when an update repairs shortcuts that were deleted or never installed.
const desktopShortcutScript = `$ErrorActionPreference='Stop';
      $wsh=New-Object -ComObject WScript.Shell;
      $start=Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs';
      $desktop=$wsh.SpecialFolders.Item('Desktop');
      if ([string]::IsNullOrWhiteSpace($desktop)) { $desktop=[Environment]::GetFolderPath('Desktop') };
      if ([string]::IsNullOrWhiteSpace($desktop)) { throw 'Windows did not supply a Desktop directory.' };
      foreach ($folder in @($start,$desktop)) {
        New-Item -ItemType Directory -Path $folder -Force -ErrorAction Stop | Out-Null;
        $shortcut=$wsh.CreateShortcut((Join-Path $folder 'Role Credits Studio.lnk'));
        $shortcut.TargetPath=$env:RC_INSTALL_TARGET;
        $shortcut.WorkingDirectory=Split-Path -Parent $env:RC_INSTALL_TARGET;
        $shortcut.IconLocation=$env:RC_INSTALL_ICON;
        $shortcut.Description='Role Credits Studio - A Saturday Morning TV TTRPG';
        $shortcut.Save();
      }`

func setupShortcuts() error {
	if runtime.GOOS != "windows" {
		return nil
	}
	cmd := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", desktopShortcutScript)
	cmd.Env = append(os.Environ(), "RC_INSTALL_TARGET="+installLocation(), "RC_INSTALL_ICON="+filepath.Join(appInstallDir(), "Role_Credits.ico")+",0")
	if data, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("could not create branded Desktop and Start Menu shortcuts: %w: %s", err, strings.TrimSpace(string(data)))
	}
	return nil
}

// Stop only this product's already-installed executable. Otherwise a prior
// process keeps serving the old embedded character sheet at the fixed localhost
// port, even after the new files have been successfully installed.
func stopPreviousDesktopServer(target string) error {
	if runtime.GOOS != "windows" {
		return nil
	}
	script := `$ErrorActionPreference='Stop';
$installed=$env:RC_INSTALL_TARGET;
Get-CimInstance Win32_Process -Filter "Name = 'Role_Credits.exe'" -ErrorAction Stop | ForEach-Object {
  if ($_.ExecutablePath -and [string]::Equals($_.ExecutablePath,$installed,[StringComparison]::OrdinalIgnoreCase)) {
    Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop
  }
}`
	cmd := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script)
	cmd.Env = append(os.Environ(), "RC_INSTALL_TARGET="+target)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("could not stop the previous Role Credits instance: %w: %s", err, strings.TrimSpace(string(output)))
	}
	time.Sleep(300 * time.Millisecond)
	return nil
}

func doInstall(relaunch bool) error {
	exe, e := os.Executable()
	if e != nil {
		return e
	}
	bytes, e := os.ReadFile(exe)
	if e != nil {
		return e
	}
	dest := installLocation()
	// Installer upgrades take over the app's fixed local port from older copies.
	// Closing the prior installed binary first prevents opening a stale sheet.
	if e = stopPreviousDesktopServer(dest); e != nil {
		return e
	}
	if e = os.MkdirAll(filepath.Dir(dest), 0755); e != nil {
		return e
	}
	staged := dest + ".new"
	if e = os.WriteFile(staged, bytes, 0700); e != nil {
		return e
	}
	// Windows protects running executables. Never wipe the old binary before a replacement is ready.
	var swapErr error
	for i := 0; i < 45; i++ {
		if e := os.Rename(staged, dest); e == nil {
			swapErr = nil
			break
		} else {
			swapErr = e
		}
		// Windows will not replace an existing target with os.Rename. Keep a backup until swap succeeds.
		old := dest + ".previous"
		if e := os.Rename(dest, old); e == nil {
			if e2 := os.Rename(staged, dest); e2 == nil {
				swapErr = nil
				_ = os.Remove(old)
				break
			}
			_ = os.Rename(old, dest)
		}
		time.Sleep(time.Second)
	}
	if swapErr != nil {
		return fmt.Errorf("could not replace launcher (another process may still be running): %w", swapErr)
	}
	// The dedicated icon file survives executable replacement and gives Windows shortcuts
	// a stable branded icon, even while Explorer is refreshing the executable icon cache.
	if e = os.WriteFile(filepath.Join(appInstallDir(), "Role_Credits.ico"), applicationIcon, 0644); e != nil {
		return fmt.Errorf("installing Role Credits icon: %w", e)
	}
	if e = setupShortcuts(); e != nil {
		return e
	}
	if relaunch {
		return exec.Command(dest).Start()
	}
	return nil
}
func openBrowser() {
	if runtime.GOOS == "windows" {
		_ = exec.Command("rundll32.exe", "url.dll,FileProtocolHandler", "http://127.0.0.1:"+port+"/").Start()
	}
}
func apiJSON(w http.ResponseWriter, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	_ = json.NewEncoder(w).Encode(value)
}
func htmlWithUpdater() (string, error) {
	b, e := appHTML.ReadFile("Role_Credits_Studio_Standalone.html")
	if e != nil {
		return "", e
	}
	s := string(b)
	// The browser window uses the same icon as the Windows shortcut.
	s = strings.Replace(s, "</head>", `<link rel="icon" type="image/x-icon" href="/favicon.ico"></head>`, 1)
	injection := `<style id="rc-windows-updater-style">#rc-win-updater{position:fixed;z-index:2147483640;bottom:12px;left:12px;background:#082f55;color:white;border:2px solid #f6c83f;border-radius:12px;padding:8px 11px;font:12px Arial,sans-serif;box-shadow:0 7px 20px #112c4b55;max-width:min(340px,90vw)}#rc-win-updater button{width:auto;background:#f6c83f;color:#082f55;border:0;border-radius:6px;padding:5px 10px;margin-left:8px;font-weight:bold;cursor:pointer}#rc-win-updater small{display:block;margin-top:5px;color:#fff3ba}</style><div id="rc-win-updater"><span id="rc-update-label">Desktop v` + appVersion + `</span><button id="rc-update-button">Check for Updates</button><small id="rc-update-status" aria-live="polite"></small></div><script id="rc-win-updater-script">(function(){let b=document.getElementById('rc-update-button'),l=document.getElementById('rc-update-label'),s=document.getElementById('rc-update-status');async function check(force){try{s.textContent='Checking GitHub Releases...';let r=await fetch('/__rc_update?mode=check'+(force?'&force=1':''));let j=await r.json();if(j.status==='available'){l.textContent='Update available: '+j.version;b.textContent='Install Update';b.onclick=install;s.textContent='Your campaigns stay in this browser.'}else if(j.status==='current'){s.textContent='You have the latest published desktop version.'}else{s.textContent='Update check unavailable: '+(j.message||j.status)}}catch(e){s.textContent='Offline or unable to check updates.'}}async function install(){if(!confirm('Download and install the verified Role Credits update? Save any unsaved character edits first.'))return;b.disabled=true;s.textContent='Downloading and verifying installer...';try{let r=await fetch('/__rc_update?mode=install',{method:'POST'});let j=await r.json();s.textContent=j.message||j.status;if(j.status!=='launching')b.disabled=false}catch(e){s.textContent='Update failed: '+e.message;b.disabled=false}}b.onclick=()=>check(true);setTimeout(()=>check(false),1600)})();</script>`
	if strings.Contains(strings.ToLower(s), "</body>") {
		i := strings.LastIndex(strings.ToLower(s), "</body>")
		return s[:i] + injection + s[i:], nil
	}
	return s + injection, nil
}
func serve() error {
	listener, e := net.Listen("tcp", "127.0.0.1:"+port)
	if e != nil {
		openBrowser()
		return fmt.Errorf("a launcher is already using local port %s: %w", port, e)
	}
	page, e := htmlWithUpdater()
	if e != nil {
		return e
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/favicon.ico", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "image/x-icon")
		w.Header().Set("Cache-Control", "public, max-age=86400")
		_, _ = w.Write(applicationIcon)
	})
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		_, _ = io.WriteString(w, page)
	})
	mux.HandleFunc("/__rc_update", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "http://127.0.0.1:"+port)
		mode := r.URL.Query().Get("mode")
		if mode == "check" && r.Method == "GET" {
			apiJSON(w, checkUpdates(r.URL.Query().Get("force") == "1"))
			return
		}
		if mode != "install" || r.Method != "POST" {
			http.Error(w, "bad request", 400)
			return
		}
		if r.Header.Get("Origin") != "http://127.0.0.1:"+port {
			http.Error(w, "invalid origin", 403)
			return
		}
		updater.mu.Lock()
		c := updater.candidate
		if updater.downloading || c == nil {
			updater.mu.Unlock()
			apiJSON(w, map[string]any{"status": "error", "message": "No verified newer release is selected."})
			return
		}
		updater.downloading = true
		updater.mu.Unlock()
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
		defer cancel()
		file, e := verifiedInstaller(ctx, *c)
		if e != nil {
			updater.mu.Lock()
			updater.downloading = false
			updater.mu.Unlock()
			apiJSON(w, map[string]any{"status": "error", "message": e.Error()})
			return
		}
		proc := exec.Command(file, "--install", "--relaunch")
		if e = proc.Start(); e != nil {
			updater.mu.Lock()
			updater.downloading = false
			updater.mu.Unlock()
			apiJSON(w, map[string]any{"status": "error", "message": e.Error()})
			return
		}
		apiJSON(w, map[string]any{"status": "launching", "message": "Verified installer started. The desktop app is restarting."})
		go func() { time.Sleep(900 * time.Millisecond); os.Exit(0) }()
	})
	server := &http.Server{Handler: mux, ReadHeaderTimeout: 8 * time.Second}
	go func() { time.Sleep(350 * time.Millisecond); openBrowser() }()
	log.Printf("%s v%s at http://127.0.0.1:%s/", appName, appVersion, port)
	return server.Serve(listener)
}
func main() {
	if len(os.Args) > 1 && (os.Args[1] == "--install" || os.Args[1] == "/install") {
		if e := doInstall(true); e != nil {
			log.Print(e)
			if runtime.GOOS == "windows" {
				_ = exec.Command("cmd", "/c", "start", "", "cmd", "/k", "echo Role Credits install error: "+e.Error()).Start()
			}
			os.Exit(1)
		}
		return
	}
	if strings.Contains(strings.ToLower(filepath.Base(os.Args[0])), "setup") {
		if e := doInstall(true); e != nil {
			log.Fatal(e)
		}
		return
	}
	if e := serve(); e != nil {
		log.Print(e)
		os.Exit(1)
	}
}
