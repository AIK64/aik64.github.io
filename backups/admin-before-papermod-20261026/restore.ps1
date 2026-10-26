$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$adminPath = Join-Path $projectRoot 'static/admin'
# Only restore the two original files. Added theme assets become unused and may stay.
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'admin/index.html') -Destination (Join-Path $adminPath 'index.html') -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'admin/config.yml') -Destination (Join-Path $adminPath 'config.yml') -Force
Write-Host 'Original Decap admin restored. Commit and deploy to update the online site.'
