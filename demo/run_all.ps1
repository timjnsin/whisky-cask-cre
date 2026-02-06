$ErrorActionPreference = "Stop"

npm run seed

$api = Start-Process -FilePath "npm" -ArgumentList "run", "dev:api" -PassThru -WindowStyle Hidden
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
}
