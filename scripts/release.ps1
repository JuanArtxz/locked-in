# Locked In release script
# Usage: .\scripts\release.ps1  (run from the repo root, after bumping "version" in src-tauri\tauri.conf.json)
# Builds a signed installer, creates the GitHub release, uploads the artifacts
# and updates latest.json so every installed app shows the update popup.

$ErrorActionPreference = "Stop"
$repo = "juannastaken/locked-in"

$conf = Get-Content "src-tauri\tauri.conf.json" -Raw | ConvertFrom-Json
$version = $conf.version
Write-Host "Releasing v$version" -ForegroundColor Green

# signed build (private key never lives in the repo)
$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content "$env:USERPROFILE\.tauri\lockedin.key" -Raw
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ""
npm run tauri build
if ($LASTEXITCODE -ne 0) { throw "build failed" }

$bundle = "src-tauri\target\release\bundle\nsis"
$exe = Get-ChildItem "$bundle\*_$($version)_x64-setup.exe" | Select-Object -First 1
$sig = Get-ChildItem "$bundle\*_$($version)_x64-setup.exe.sig" | Select-Object -First 1
if (-not $exe -or -not $sig) { throw "installer or signature not found in $bundle" }

# github release with both artifacts
gh release create "v$version" $exe.FullName $sig.FullName --repo $repo --title "Locked In v$version" --generate-notes
if ($LASTEXITCODE -ne 0) { throw "gh release failed" }

# updater manifest — the asset name GitHub exposes replaces spaces with dots
$assetName = $exe.Name -replace ' ', '.'
$manifest = [ordered]@{
  version   = $version
  pub_date  = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
  platforms = [ordered]@{
    "windows-x86_64" = [ordered]@{
      signature = (Get-Content $sig.FullName -Raw)
      url       = "https://github.com/$repo/releases/download/v$version/$assetName"
    }
  }
}
$manifest | ConvertTo-Json -Depth 5 | Out-File "latest.json" -Encoding utf8

git add latest.json
git commit -m "release v$version"
git push
Write-Host "v$version released — every app will show the update popup within 6h (or on next launch)" -ForegroundColor Green
