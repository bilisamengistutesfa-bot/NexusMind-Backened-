$payload = @{
  userId = "test-user-id"
  type = "solution"
  text = "Test notification"
  senderName = "Test User"
  avatar = "https://picsum.photos/seed/test/100/100"
  read = $false
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:3001/api/notifications" -Method POST -Body $payload -ContentType "application/json" -UseBasicParsing