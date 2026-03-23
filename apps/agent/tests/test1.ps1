# 1. Create thread
$thread = Invoke-RestMethod -Method Post -Uri "http://localhost:2024/threads" `
  -ContentType "application/json" -Body '{}'
$tid = $thread.thread_id
Write-Host "Thread ID: $tid"

# 2. Stream a message and save ALL SSE output to file
$streamBody = @{
  input = @{
    messages = @(@{ type = "human"; content = "Say hi briefly" })
  }
  stream_mode = @("values", "updates", "messages")
  config = @{
    configurable = @{
      model_config = @{
        provider  = "ollama"
        modelName = "glm-5:cloud"
        apiKey    = ""
      }
    }
  }
} | ConvertTo-Json -Depth 10

$resp = Invoke-WebRequest -Method Post `
  -Uri "http://localhost:2024/threads/$tid/runs/stream" `
  -ContentType "application/json" `
  -Body $streamBody -TimeoutSec 60
$resp.Content | Out-File -Encoding utf8 "$env:USERPROFILE\stream_debug.txt"
Write-Host "Stream done. Saved to stream_debug.txt"
$tid | Out-File -Encoding utf8 "$env:USERPROFILE\thread_id.txt"
