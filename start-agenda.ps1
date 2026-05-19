$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectDir

$existing = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue
if ($existing) {
  exit 0
}

npm.cmd run build
npm.cmd run preview -- --host 0.0.0.0 --port 5173
