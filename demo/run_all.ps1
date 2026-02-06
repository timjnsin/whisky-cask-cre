$ErrorActionPreference = "Stop"

npm run seed

$api = Start-Process -FilePath "npx" -ArgumentList "tsx", "api/src/index.ts" -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 2

try {
  npm run simulate:por
  npm run simulate:attributes
  npm run simulate:lifecycle:webhook
  npm run simulate:lifecycle:reconcile
}
finally {
  if ($api -and -not $api.HasExited) {
    Stop-Process -Id $api.Id -Force
  }

  $conn = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($conn) {
    Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
  }
}
