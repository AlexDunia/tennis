param(
  [Parameter(Mandatory = $true)][int]$Width,
  [Parameter(Mandatory = $true)][int]$Height,
  [Parameter(Mandatory = $true)][int]$Port,
  [Parameter(Mandatory = $true)][string]$OutputName
)

$ErrorActionPreference = 'Stop'
$workspacePath = (Resolve-Path 'C:\Users\HP\sportsproject').Path
$chromePath = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$artifactPath = Join-Path $workspacePath 'artifacts'
$profilePath = Join-Path $workspacePath ".dashboard-check-$Port"
$outputPath = Join-Path $artifactPath $OutputName

if (-not (Test-Path -LiteralPath $chromePath)) {
  throw 'Chrome is not installed at the expected path.'
}

New-Item -ItemType Directory -Path $artifactPath -Force | Out-Null
New-Item -ItemType Directory -Path $profilePath -Force | Out-Null

$browserProcess = Start-Process -FilePath $chromePath -ArgumentList @(
  '--headless=new',
  '--disable-gpu',
  '--disable-background-networking',
  '--no-first-run',
  '--no-default-browser-check',
  "--remote-debugging-port=$Port",
  "--user-data-dir=$profilePath",
  "--window-size=$Width,$Height",
  'http://127.0.0.1:5173/signin'
) -WindowStyle Hidden -PassThru

try {
  $targets = $null
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    try {
      $targets = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/json/list" -TimeoutSec 2
      if ($targets) { break }
    } catch {
      Start-Sleep -Milliseconds 200
    }
  }

  $target = $targets | Where-Object { $_.type -eq 'page' } | Select-Object -First 1
  if (-not $target.webSocketDebuggerUrl) {
    throw 'No headless browser page target was available.'
  }

  $socket = [System.Net.WebSockets.ClientWebSocket]::new()
  $socket.ConnectAsync([Uri]$target.webSocketDebuggerUrl, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
  $messageId = 0

  function Invoke-CdpCommand {
    param([string]$Method, [hashtable]$Params = @{})
    $script:messageId += 1
    $payload = @{ id = $script:messageId; method = $Method; params = $Params } | ConvertTo-Json -Depth 12 -Compress
    $payloadBytes = [Text.Encoding]::UTF8.GetBytes($payload)
    $sendSegment = [ArraySegment[byte]]::new($payloadBytes)
    $socket.SendAsync(
      $sendSegment,
      [System.Net.WebSockets.WebSocketMessageType]::Text,
      $true,
      [Threading.CancellationToken]::None
    ).GetAwaiter().GetResult()

    do {
      $buffer = New-Object byte[] 1048576
      $receiveSegment = [ArraySegment[byte]]::new($buffer)
      $result = $socket.ReceiveAsync($receiveSegment, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
      $message = [Text.Encoding]::UTF8.GetString($buffer, 0, $result.Count) | ConvertFrom-Json
    } while ($message.id -ne $script:messageId)

    return $message
  }

  Invoke-CdpCommand -Method 'Emulation.setDeviceMetricsOverride' -Params @{
    width = $Width
    height = $Height
    deviceScaleFactor = 1
    mobile = ($Width -le 767)
  } | Out-Null

  $authPayload = @{
    isLoggedIn = $true
    user = @{
      name = 'Amina Esin'
      email = 'amina@example.com'
      playerId = 'player-05'
      roleKey = 'player'
    }
  } | ConvertTo-Json -Depth 5 -Compress
  $escapedAuth = $authPayload.Replace('\', '\\').Replace("'", "\'")
  $seedExpression = "localStorage.setItem('sheltennis-auth', '$escapedAuth'); localStorage.setItem('gorra.appDataMode.v1', 'demo'); location.assign('/dashboard'); true;"
  Invoke-CdpCommand -Method 'Runtime.evaluate' -Params @{ expression = $seedExpression } | Out-Null

  Start-Sleep -Seconds 3

  $metricsExpression = @"
(() => {
  const content = document.querySelector('.content');
  const dashboard = document.querySelector('.member-home');
  const rail = document.querySelector('.member-home__activity-rail');
  return {
    url: location.href,
    title: document.title,
    viewportWidth: innerWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    contentWidth: content ? Math.round(content.getBoundingClientRect().width) : null,
    dashboardWidth: dashboard ? Math.round(dashboard.getBoundingClientRect().width) : null,
    ladderRows: document.querySelectorAll('.member-ladder__row').length,
    activityCards: document.querySelectorAll('.club-activity-card').length,
    opportunityBanners: document.querySelectorAll('.club-opportunity').length,
    activityScrollable: rail ? rail.scrollWidth > rail.clientWidth : false,
    bodyText: document.body.innerText.slice(0, 500)
  };
})()
"@
  $metricResult = Invoke-CdpCommand -Method 'Runtime.evaluate' -Params @{
    expression = $metricsExpression
    returnByValue = $true
  }

  $screenshot = Invoke-CdpCommand -Method 'Page.captureScreenshot' -Params @{
    format = 'png'
    captureBeyondViewport = $true
    fromSurface = $true
  }
  [IO.File]::WriteAllBytes($outputPath, [Convert]::FromBase64String($screenshot.result.data))

  [PSCustomObject]@{
    output = $outputPath
    metrics = $metricResult.result.result.value
  } | ConvertTo-Json -Depth 8

  $socket.CloseAsync(
    [System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure,
    'done',
    [Threading.CancellationToken]::None
  ).GetAwaiter().GetResult()
  $socket.Dispose()
} finally {
  if ($browserProcess -and -not $browserProcess.HasExited) {
    Stop-Process -Id $browserProcess.Id -Force -ErrorAction SilentlyContinue
  }
}
