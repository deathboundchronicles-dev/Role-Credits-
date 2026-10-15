package main

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestVersionCompare(t *testing.T) {
	cases := []struct {
		a, b string
		want bool
	}{
		{"v0.2.1.3", "0.2.1.2", true},
		{"desktop-v0.2.1.3", "0.2.1.2", true},
		{"0.2.1.2", "0.2.1.2", false},
		{"0.2.1.2", "0.2.1.3", false},
		{"0.2.1.10", "0.2.1.9", true},
		{"garbage", "0.2.1.3", false},
		{"0.3.0", "0.2.99", true},
	}
	for _, c := range cases {
		if got := newer(c.a, c.b); got != c.want {
			t.Errorf("newer(%q,%q)=%t want %t", c.a, c.b, got, c.want)
		}
	}
}
func TestReleaseSelection(t *testing.T) {
	ok := []asset{{Name: assetInstaller, URL: "https://github.com/good.exe", Size: 100}, {Name: assetChecksum, URL: "https://github.com/good.sha256", Size: 70}}
	data := []release{{Tag: "v0.2.1.8", Draft: true, Assets: ok}, {Tag: "v0.2.1.7", Assets: ok}, {Tag: "v0.2.1.9", Assets: []asset{{Name: assetInstaller, URL: "https://example.com", Size: 100}}}, {Tag: "v0.2.1.6", Prerelease: true, Assets: ok}}
	choice := bestRelease(data, "0.2.1.3")
	if choice == nil || choice.Version != "v0.2.1.7" {
		t.Fatalf("unexpected choice: %+v", choice)
	}
	if bestRelease(data, "0.2.1.9") != nil {
		t.Fatal("old release selected")
	}
}
func TestChecksumParsing(t *testing.T) {
	h := sha256.Sum256([]byte("hello"))
	want := hex.EncodeToString(h[:])
	for _, s := range []string{want, want + "  Role_Credits_Setup.exe", "SHA256(Role_Credits_Setup.exe)= " + want} {
		got, e := extractDigest(s)
		if e != nil || got != want {
			t.Fatalf("digest failure: %v %q", e, got)
		}
	}
	if _, e := extractDigest("invalid"); e == nil {
		t.Fatal("accepted invalid checksum")
	}
}
func TestUpdaterUI(t *testing.T) {
	s, e := htmlWithUpdater()
	if e != nil {
		t.Fatal(e)
	}
	for _, needle := range []string{"Check for Updates", "/__rc_update?mode=check", "/__rc_update?mode=install", "</body>"} {
		if !strings.Contains(s, needle) {
			t.Errorf("missing %s", needle)
		}
	}
}

// The full transfer path is exercised against a TLS test server. The executable
// fixture uses MZ bytes without executing it, so this runs on Linux and Windows.
func TestVerifiedInstallerDownloadAndMismatch(t *testing.T) {
	payload := append([]byte{'M', 'Z'}, []byte("synthetic-windows-fixture")...)
	sum := sha256.Sum256(payload)
	good := hex.EncodeToString(sum[:])
	oldClient := httpClient
	defer func() { httpClient = oldClient }()
	tamper := false
	srv := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/sha":
			fmt.Fprint(w, good+"  Role_Credits_Setup.exe\n")
		case "/exe":
			if tamper {
				w.Write([]byte("MZtampered"))
			} else {
				w.Write(payload)
			}
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()
	httpClient = srv.Client()
	c := releaseCandidate{Version: "v0.2.1.4", SHA: asset{URL: srv.URL + "/sha"}, Setup: asset{URL: srv.URL + "/exe"}}
	filename, e := verifiedInstaller(context.Background(), c)
	if e != nil {
		t.Fatal(e)
	}
	defer os.RemoveAll(filepath.Dir(filename))
	read, e := os.ReadFile(filename)
	if e != nil || !bytes.Equal(read, payload) {
		t.Fatal("downloaded bytes changed", e)
	}
	tamper = true
	if _, e = verifiedInstaller(context.Background(), c); e == nil || !strings.Contains(e.Error(), "mismatch") {
		t.Fatalf("tampered installer not blocked: %v", e)
	}
}
