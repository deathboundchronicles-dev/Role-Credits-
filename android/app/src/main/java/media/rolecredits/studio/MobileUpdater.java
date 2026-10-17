package media.rolecredits.studio;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.widget.ProgressBar;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Explicit-consent, signed Android update channel for GitHub Releases.
 * No executable downloads are ever loaded into WebView or silently installed.
 */
public final class MobileUpdater {
    private static final String REPO = "deathboundchronicles-dev/Role-Credits-";
    private static final String API = "https://api.github.com/repos/" + REPO + "/releases?per_page=30";
    private static final String APK_ASSET = "Role_Credits_Android.apk";
    private static final String SHA_ASSET = "Role_Credits_Android.sha256";
    private static final int REQUEST_INSTALL_PERMISSION = 2004;
    private static final int MAX_METADATA = 2 * 1024 * 1024;
    private static final long MAX_APK = 120L * 1024 * 1024;
    private static final long CHECK_INTERVAL = 24L * 60 * 60 * 1000;
    private static final Pattern HEX_CHECKSUM = Pattern.compile("(?m)^([0-9A-Fa-f]{64})\\s+\\*?Role_Credits_Android\\.apk\\s*$");
    private static final Pattern VERSION = Pattern.compile("^v?(\\d+)\\.(\\d+)\\.(\\d+)(?:\\.(\\d+))?$", Pattern.CASE_INSENSITIVE);

    private final Activity activity;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final AtomicBoolean busy = new AtomicBoolean(false);
    private volatile boolean waitingForInstallPermission;

    public MobileUpdater(Activity activity) { this.activity = activity; }

    public void checkInBackgroundIfDue() {
        long now = System.currentTimeMillis();
        long previous = activity.getPreferences(Activity.MODE_PRIVATE).getLong("android_last_update_check", 0L);
        if (previous > 0 && now - previous < CHECK_INTERVAL) return;
        activity.getPreferences(Activity.MODE_PRIVATE).edit().putLong("android_last_update_check", now).apply();
        check(false);
    }

    public void checkNow() { check(true); }

    private void check(boolean manual) {
        if (!busy.compareAndSet(false, true)) {
            if (manual) toast("An update check is already running");
            return;
        }
        if (manual) toast("Checking signed Android releases…");
        new Thread(() -> {
            try {
                Release release = latestCompatibleRelease();
                runUI(() -> {
                    if (release == null) {
                        if (manual) new AlertDialog.Builder(activity)
                                .setTitle("Role Credits is up to date")
                                .setMessage("No newer signed Android APK is published on GitHub Releases. Debug build artifacts are not used for updates.")
                                .setPositiveButton("OK", null).show();
                    } else {
                        offerUpdate(release);
                    }
                });
            } catch (Exception ex) {
                if (manual) runUI(() -> error("Update check failed", ex));
            } finally { busy.set(false); }
        }, "RC-Android-Update-Check").start();
    }

    private String installedVersion() throws Exception {
        PackageInfo info = activity.getPackageManager().getPackageInfo(activity.getPackageName(), 0);
        return info.versionName != null ? info.versionName : "0.0.0";
    }

    private static int compareVersions(String a, String b) {
        Matcher am = VERSION.matcher(a), bm = VERSION.matcher(b);
        if (!am.matches() || !bm.matches()) return -999;
        for (int i = 1; i <= 4; i++) {
            int av = am.group(i) == null ? 0 : Integer.parseInt(am.group(i));
            int bv = bm.group(i) == null ? 0 : Integer.parseInt(bm.group(i));
            if (av != bv) return Integer.compare(av, bv);
        }
        return 0;
    }

    private Release latestCompatibleRelease() throws Exception {
        String current = installedVersion();
        JSONArray releases = new JSONArray(readText(API, MAX_METADATA));
        Release best = null;
        for (int i = 0; i < releases.length(); i++) {
            JSONObject item = releases.getJSONObject(i);
            if (item.optBoolean("draft", false)) continue;
            String tag = item.optString("tag_name", "");
            if (compareVersions(tag, current) <= 0) continue;
            JSONArray assets = item.optJSONArray("assets");
            if (assets == null) continue;
            String apk = null, sha = null;
            for (int j = 0; j < assets.length(); j++) {
                JSONObject asset = assets.getJSONObject(j);
                String name = asset.optString("name", "");
                if (name.equals(APK_ASSET)) apk = asset.optString("browser_download_url", "");
                if (name.equals(SHA_ASSET)) sha = asset.optString("browser_download_url", "");
            }
            if (apk == null || sha == null) continue;
            assertGitHubReleaseAsset(apk);
            assertGitHubReleaseAsset(sha);
            if (best == null || compareVersions(tag, best.tag) > 0) best = new Release(tag, apk, sha);
        }
        return best;
    }

    private static final class Release {
        final String tag, apkUrl, checksumUrl;
        Release(String tag, String apk, String sha) { this.tag=tag; this.apkUrl=apk; this.checksumUrl=sha; }
    }

    private static void assertGitHubReleaseAsset(String url) throws Exception {
        URL parsed = new URL(url);
        if (!"https".equalsIgnoreCase(parsed.getProtocol())
                || !"github.com".equalsIgnoreCase(parsed.getHost())
                || !parsed.getPath().startsWith("/"+REPO+"/releases/download/")) {
            throw new SecurityException("Untrusted Android release asset URL");
        }
    }

    private void offerUpdate(Release release) {
        new AlertDialog.Builder(activity)
                .setTitle("Role Credits " + release.tag + " available")
                .setMessage("A newer signed Android release is available. Download and verify it, then let Android install it?\n\nYour characters and campaigns stay on this device when the same signing key is used.")
                .setNegativeButton("Later", null)
                .setPositiveButton("Download update", (dialog, which) -> downloadUpdate(release))
                .show();
    }

    private void downloadUpdate(Release release) {
        if (!busy.compareAndSet(false, true)) { toast("Already downloading an update"); return; }
        ProgressBar progress = new ProgressBar(activity);
        progress.setIndeterminate(true);
        final AlertDialog dialog = new AlertDialog.Builder(activity)
                .setTitle("Downloading Role Credits " + release.tag)
                .setMessage("Downloading and checking the official signed APK…")
                .setView(progress)
                .setCancelable(false).create();
        dialog.show();
        new Thread(() -> {
            File temporary = null;
            try {
                String digest = fetchExpectedChecksum(release.checksumUrl);
                File destination = UpdateApkProvider.updateFile(activity);
                File folder = destination.getParentFile();
                if (!folder.exists() && !folder.mkdirs()) throw new Exception("Cannot create update storage");
                temporary = new File(folder, "download.pending");
                if (temporary.exists()) temporary.delete();
                String actual = downloadWithDigest(release.apkUrl, temporary);
                if (!digest.equalsIgnoreCase(actual)) throw new SecurityException("Checksum mismatch: download was rejected");
                verifyApk(temporary, release.tag);
                if (destination.exists() && !destination.delete()) throw new Exception("Could not replace staged update");
                if (!temporary.renameTo(destination)) throw new Exception("Could not stage verified APK");
                runUI(() -> { dialog.dismiss(); requestAndroidInstallation(); });
            } catch (Exception ex) {
                if (temporary != null && temporary.exists()) temporary.delete();
                runUI(() -> { dialog.dismiss(); error("Update rejected", ex); });
            } finally { busy.set(false); }
        }, "RC-Android-Update-Download").start();
    }

    private static String fetchExpectedChecksum(String url) throws Exception {
        String content = readText(url, 16 * 1024).trim();
        Matcher matcher = HEX_CHECKSUM.matcher(content);
        if (!matcher.find()) throw new SecurityException("Missing or invalid Android APK checksum");
        return matcher.group(1).toLowerCase(Locale.ROOT);
    }

    private static HttpURLConnection connection(String link) throws Exception {
        URL url = new URL(link);
        if (!"https".equalsIgnoreCase(url.getProtocol())) throw new SecurityException("HTTPS required");
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setInstanceFollowRedirects(true);
        conn.setConnectTimeout(16000);
        conn.setReadTimeout(30000);
        conn.setRequestProperty("User-Agent", "RoleCreditsStudio-Android-Updater");
        conn.setRequestProperty("Accept", "application/vnd.github+json");
        int status = conn.getResponseCode();
        if (status != 200) { conn.disconnect(); throw new Exception("GitHub returned HTTP " + status); }
        if (!"https".equalsIgnoreCase(conn.getURL().getProtocol())) { conn.disconnect(); throw new SecurityException("Untrusted redirect"); }
        return conn;
    }

    private static String readText(String link, int cap) throws Exception {
        HttpURLConnection conn = connection(link);
        try (InputStream input = new BufferedInputStream(conn.getInputStream());
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] block = new byte[8192]; int n;
            while ((n = input.read(block)) != -1) {
                if (out.size() + n > cap) throw new Exception("Oversized update metadata");
                out.write(block, 0, n);
            }
            return out.toString(StandardCharsets.UTF_8.name());
        } finally { conn.disconnect(); }
    }

    private static String downloadWithDigest(String link, File target) throws Exception {
        HttpURLConnection conn = connection(link);
        try (InputStream in = new BufferedInputStream(conn.getInputStream());
             FileOutputStream out = new FileOutputStream(target)) {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] block = new byte[64 * 1024]; long total = 0; int n;
            while ((n = in.read(block)) != -1) {
                total += n;
                if (total > MAX_APK) throw new Exception("APK exceeds maximum update size");
                digest.update(block, 0, n);
                out.write(block, 0, n);
            }
            out.getFD().sync();
            if (total == 0) throw new Exception("Downloaded APK is empty");
            StringBuilder hex = new StringBuilder(64);
            for (byte b : digest.digest()) hex.append(String.format(Locale.ROOT, "%02x", b & 0xff));
            return hex.toString();
        } finally { conn.disconnect(); }
    }

    /** Android itself makes the final authorization decision at the system installation screen. */
    private void verifyApk(File apk, String expectedVersion) throws Exception {
        PackageManager pm = activity.getPackageManager();
        int flags = Build.VERSION.SDK_INT >= 28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
        PackageInfo proposed = pm.getPackageArchiveInfo(apk.getAbsolutePath(), flags);
        PackageInfo installed = pm.getPackageInfo(activity.getPackageName(), flags);
        if (proposed == null || !activity.getPackageName().equals(proposed.packageName))
            throw new SecurityException("APK does not belong to Role Credits Studio");
        if (expectedVersion != null && compareVersions(expectedVersion, proposed.versionName == null ? "" : proposed.versionName) != 0)
            throw new SecurityException("APK version does not match the GitHub release tag");
        long newCode = Build.VERSION.SDK_INT >= 28 ? proposed.getLongVersionCode() : proposed.versionCode;
        long oldCode = Build.VERSION.SDK_INT >= 28 ? installed.getLongVersionCode() : installed.versionCode;
        if (newCode <= oldCode) throw new SecurityException("Downloaded APK is not newer than the installed version");
        Signature[] newSignatures, currentSignatures;
        if (Build.VERSION.SDK_INT >= 28) {
            if (proposed.signingInfo == null || installed.signingInfo == null) throw new SecurityException("APK signing information unavailable");
            newSignatures = proposed.signingInfo.getApkContentsSigners();
            currentSignatures = installed.signingInfo.getApkContentsSigners();
        } else {
            newSignatures = proposed.signatures;
            currentSignatures = installed.signatures;
        }
        if (newSignatures == null || newSignatures.length == 0 || !Arrays.equals(newSignatures, currentSignatures)) {
            throw new SecurityException("APK uses a different signing key. Export your backup before migrating from the original debug build. Never uninstall without backing up.");
        }
    }

    private void requestAndroidInstallation() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && !activity.getPackageManager().canRequestPackageInstalls()) {
            waitingForInstallPermission = true;
            new AlertDialog.Builder(activity)
                    .setTitle("Allow Role Credits updates")
                    .setMessage("Android needs permission to install updates from Role Credits. You control the final installation confirmation.")
                    .setNegativeButton("Not now", (d, w) -> waitingForInstallPermission = false)
                    .setPositiveButton("Open Android settings", (d, w) -> {
                        Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                                Uri.parse("package:" + activity.getPackageName()));
                        try { activity.startActivityForResult(intent, REQUEST_INSTALL_PERMISSION); }
                        catch (Exception ex) { waitingForInstallPermission=false; error("Installer settings unavailable", ex); }
                    }).show();
            return;
        }
        waitingForInstallPermission = false;
        File apk = UpdateApkProvider.updateFile(activity);
        try {
            verifyApk(apk, null);
            Uri uri = UpdateApkProvider.updateUri(activity);
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.setClipData(ClipData.newRawUri(APK_ASSET, uri));
            activity.startActivity(intent);
        } catch (Exception ex) { error("Unable to install update", ex); }
    }

    public boolean onActivityResult(int requestCode) {
        if (requestCode != REQUEST_INSTALL_PERMISSION) return false;
        if (waitingForInstallPermission && (Build.VERSION.SDK_INT < 26 || activity.getPackageManager().canRequestPackageInstalls())) {
            requestAndroidInstallation();
        } else if (waitingForInstallPermission) {
            toast("Installation permission wasn't granted. The verified APK remains saved.");
            waitingForInstallPermission = false;
        }
        return true;
    }

    private void toast(String message) { runUI(() -> Toast.makeText(activity, message, Toast.LENGTH_LONG).show()); }
    private void runUI(Runnable task) { main.post(task); }
    private void error(String title, Exception ex) {
        new AlertDialog.Builder(activity).setTitle(title)
                .setMessage(ex.getMessage() != null ? ex.getMessage() : ex.toString())
                .setPositiveButton("OK", null).show();
    }
}
