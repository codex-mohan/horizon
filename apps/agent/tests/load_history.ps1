$tid = Get-Content "$env:USERPROFILE\thread_id.txt"
$hist = Invoke-RestMethod -Method Post `
  -Uri "http://localhost:2024/threads/$tid/history" `
  -ContentType "application/json" -Body '{"limit":5}'
$hist | ConvertTo-Json -Depth 10 | Out-File -Encoding utf8 "$env:USERPROFILE\history_debug.json"
Write-Host "History saved to history_debug.json"
