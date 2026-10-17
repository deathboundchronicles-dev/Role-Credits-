#!/usr/bin/env python3
"""Fail the coordinated release if the two platform builds are inconsistent."""
from pathlib import Path
import re, sys, hashlib
root = Path(__file__).resolve().parent.parent
version = (root / 'release/VERSION').read_text(encoding='utf-8').strip()
assert re.fullmatch(r'\d+\.\d+\.\d+\.\d+', version), 'Release version must have four numeric parts'
nums = list(map(int,version.split('.')))
assert nums[0] < 2 and all(0<=n<=99 for n in nums[1:]), 'Version outside four-part Android versionCode scheme'
code = nums[0]*1000000 + nums[1]*10000 + nums[2]*100 + nums[3]
assert code > 20406, 'Android update versionCode must increase beyond signed v0.2.4.6'
if len(sys.argv)>1:
    assert sys.argv[1].strip().lstrip('v') == version, f'Requested {sys.argv[1]} != committed {version}'
android = root / 'android/app/src/main/assets/index.html'
windows = root / 'Role_Credits_Studio_Standalone.html'
assert android.is_file() and windows.is_file(), 'Missing app HTML assets'
a=android.read_bytes(); w=windows.read_bytes()
assert a == w, 'Android and Windows are not packaging identical game HTML. Sync before release.'
assert len(a)>2_000_000, 'Game HTML payload unexpectedly short'
gradle = (root / 'android/app/build.gradle').read_text(encoding='utf-8')
assert "release/VERSION" in gradle and "versionCode generatedVersionCode" in gradle and "versionName unifiedVersion" in gradle, 'Android Gradle must derive its version from release/VERSION'
activity = (root / 'android/app/src/main/java/media/rolecredits/studio/MainActivity.java').read_text(encoding='utf-8')
assert 'installedVersionLabel()' in activity, 'Android About dialog must show installed version, not stale hardcoded label'
go = (root / 'main.go').read_text(encoding='utf-8')
assert 'var appVersion' in go and 'assetInstaller' in go and 'assetChecksum' in go, 'Windows updater source changed; review release integration'
assert (root / 'Role_Credits.ico').is_file(), 'Approved Windows ICO missing'
assert (root / 'embed_windows_icon.py').is_file(), 'Windows icon embedding script missing'
assert (root / 'android/app/src/main/java/media/rolecredits/studio/MobileUpdater.java').is_file(), 'Android updater missing'
print(f'Role Credits {version} ready. Android versionCode={code}. Shared HTML SHA256={hashlib.sha256(a).hexdigest()}.')
