$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$toolRoot = Join-Path $taskRoot '.tools'
New-Item -ItemType Directory -Force -Path $toolRoot | Out-Null
$headers = @{ 'User-Agent' = 'pokemon-bot-setup' }
foreach ($tool in @('gh', 'git')) {
    $repo = if ($tool -eq 'gh') { 'cli/cli' } else { 'git-for-windows/git' }
    $release = Invoke-RestMethod -Headers $headers -Uri "https://api.github.com/repos/$repo/releases/latest"
    $pattern = if ($tool -eq 'gh') { '*windows_amd64.zip' } else { 'PortableGit-*-64-bit.7z.exe' }
    $asset = $release.assets | Where-Object { $_.name -like $pattern } | Select-Object -First 1
    if (-not $asset) { throw "No supported portable release for $tool" }
    $download = Join-Path $toolRoot $asset.name
    Invoke-WebRequest -Headers $headers -Uri $asset.browser_download_url -OutFile $download
    if ($asset.digest -notlike 'sha256:*') { throw "Missing release SHA256 for $tool" }
    $expected = $asset.digest.Substring(7)
    if ((Get-FileHash -LiteralPath $download -Algorithm SHA256).Hash -ne $expected) { throw 'Checksum mismatch' }
    $dest = Join-Path $toolRoot $tool
    if ($tool -eq 'gh') {
        Expand-Archive -LiteralPath $download -DestinationPath $dest -Force
    } else {
        $proc = Start-Process -FilePath $download -ArgumentList @('-y', "-o$dest") -WindowStyle Hidden -PassThru -Wait
        if ($proc.ExitCode -ne 0) { throw 'Portable Git extraction failed' }
    }
}
$ghPath = Get-ChildItem -LiteralPath (Join-Path $toolRoot 'gh') -Filter gh.exe -Recurse | Select-Object -First 1
$env:PATH = "$($ghPath.DirectoryName);$(Join-Path $toolRoot 'git\cmd');$env:PATH"
gh --version
git --version
Write-Host 'Portable tools installed. PATH applies to this PowerShell session. Authenticate next with gh auth login.'
