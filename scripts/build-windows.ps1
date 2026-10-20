param(
    [string]$GoExecutable = 'go',
    [string]$PythonExecutable = 'python'
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Push-Location $projectRoot
try {
    $releaseVersion = (Get-Content 'release/VERSION' -Raw).Trim()
    if ($releaseVersion -notmatch '^\d+\.\d+\.\d+\.\d+$') { throw 'Invalid release version' }
    node scripts/sync-app.mjs --check
    if ($LASTEXITCODE -ne 0) { throw 'Shared app assets are out of sync' }
    & $PythonExecutable release/check_release.py $releaseVersion
    if ($LASTEXITCODE -ne 0) { throw 'Release consistency check failed' }
    $destination = Join-Path $projectRoot "dist/v$releaseVersion"
    New-Item -ItemType Directory -Path $destination -Force | Out-Null
    $installer = Join-Path $destination 'Role_Credits_Setup.exe'
    $env:CGO_ENABLED = '0'
    & $GoExecutable build -trimpath -ldflags "-s -w -H windowsgui -X main.appVersion=$releaseVersion" -o $installer .
    if ($LASTEXITCODE -ne 0) { throw 'Windows build failed' }
    & $PythonExecutable embed_windows_icon.py $installer Role_Credits.ico
    if ($LASTEXITCODE -ne 0) { throw 'Windows icon embedding failed' }
    Copy-Item -LiteralPath $installer -Destination (Join-Path $destination 'Role_Credits.exe')
    Copy-Item -LiteralPath 'Role_Credits_Studio_Standalone.html' -Destination $destination
    $checksums = @('Role_Credits_Setup.exe', 'Role_Credits.exe', 'Role_Credits_Studio_Standalone.html') | ForEach-Object {
        $digest = (Get-FileHash -LiteralPath (Join-Path $destination $_) -Algorithm SHA256).Hash.ToLowerInvariant()
        "$digest  $_"
    }
    $checksums | Set-Content -LiteralPath (Join-Path $destination 'SHA256SUMS.txt') -Encoding ascii
    $checksums[0] | Set-Content -LiteralPath (Join-Path $destination 'Role_Credits_Setup.sha256') -Encoding ascii
    Write-Output "Built Role Credits $releaseVersion in $destination"
} finally {
    Pop-Location
}
