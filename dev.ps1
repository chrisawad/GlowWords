$ErrorActionPreference = 'Stop'

$projectDirectory = $PSScriptRoot
$pnpmCommand = Get-Command pnpm -ErrorAction SilentlyContinue

if ($pnpmCommand) {
    & $pnpmCommand.Source dev
    exit $LASTEXITCODE
}

$runtimeRoot = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies'
$bundledNode = Join-Path $runtimeRoot 'node\bin'
$bundledTools = Join-Path $runtimeRoot 'bin\fallback'
$bundledPnpm = Join-Path $bundledTools 'pnpm.cmd'

if (Test-Path -LiteralPath $bundledPnpm) {
    $env:Path = "$bundledNode;$bundledTools;$env:Path"
    Set-Location -LiteralPath $projectDirectory
    & $bundledPnpm dev
    exit $LASTEXITCODE
}

Write-Host 'Node.js and pnpm were not found.' -ForegroundColor Yellow
Write-Host 'Install Node.js from https://nodejs.org, then run:'
Write-Host '  corepack enable'
Write-Host '  corepack prepare pnpm@latest --activate'
Write-Host '  pnpm install'
Write-Host '  pnpm dev'
exit 1
