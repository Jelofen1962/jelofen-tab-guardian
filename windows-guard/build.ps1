# JTG - Jelofen's Tab Guardian | Windows companion build helper
# Crafted by: Jelofen The Dev | t.me/Jelofen1962 | +989035361164
$ErrorActionPreference = 'Stop'
$project = Join-Path $PSScriptRoot 'JTG.TabCloseGuard.csproj'
$output = Join-Path $PSScriptRoot 'publish'

dotnet publish $project `
  --configuration Release `
  --runtime win-x64 `
  --self-contained true `
  -p:PublishSingleFile=true `
  -p:IncludeNativeLibrariesForSelfExtract=true `
  --output $output

$exe = Join-Path $output 'JTG.TabCloseGuard.exe'
if (!(Test-Path $exe)) { throw "Build completed but executable was not found: $exe" }
Write-Host "Built: $exe" -ForegroundColor Green
