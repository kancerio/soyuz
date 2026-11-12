# Полный локальный запуск Soyuz с проверками каждого шага.
# Запуск: powershell -ExecutionPolicy Bypass -File scripts/start-local.ps1
#
# Что делает:
#   1) поднимает postgres/redis/ai-service через docker (если Docker доступен)
#   2) ждёт порты БД
#   3) проверяет backend\.env и собирает dist, если его нет
#   4) запускает backend (:3001) и frontend (:3000) в отдельных окнах
#   5) проверяет здоровье обоих и пишет, на каком шаге проблема

$ErrorActionPreference = 'Continue'
$root = Resolve-Path "$PSScriptRoot\.."
Set-Location $root

function Wait-Port($port, $name, $attempts = 30) {
  foreach ($i in 1..$attempts) {
    $tcp = New-Object System.Net.Sockets.TcpClient
    try {
      $iar = $tcp.BeginConnect('127.0.0.1', $port, $null, $null)
      if ($iar.AsyncWaitHandle.WaitOne(800) -and $tcp.Connected) {
        Write-Host "  [ok] $name (:$port)" -ForegroundColor Green
        return $true
      }
    } catch {} finally { $tcp.Close() }
    Start-Sleep -Milliseconds 800
  }
  Write-Host "  [FAIL] $name (:$port) не отвечает" -ForegroundColor Red
  return $false
}

Write-Host "== 1/5 Инфраструктура ==" -ForegroundColor Cyan
$dockerOk = $false
try { docker ps 2>$null | Out-Null; if ($LASTEXITCODE -eq 0) { $dockerOk = $true } } catch {}
if ($dockerOk) {
  docker compose up -d postgres redis ai-service
} else {
  Write-Host "  Docker недоступен — предполагаю, что Postgres/Redis/AI уже запущены локально" -ForegroundColor Yellow
}

Write-Host "== 2/5 Порты БД ==" -ForegroundColor Cyan
if (-not (Wait-Port 5432 'Postgres')) {
  Write-Host "  Postgres не отвечает. Подними его (docker compose up -d postgres) и перезапусти скрипт." -ForegroundColor Red
  exit 1
}
if (-not (Wait-Port 6379 'Redis' 5)) {
  Write-Host "  Redis не отвечает — кэш переводов будет отдавать 500. Рекомендую поднять: docker compose up -d redis" -ForegroundColor Yellow
}

Write-Host "== 3/5 Backend: конфиг и сборка ==" -ForegroundColor Cyan
if (-not (Test-Path 'backend\.env')) {
  Copy-Item 'backend\.env.example' 'backend\.env'
  Write-Host "  Создан backend\.env из примера — проверь DB_PASSWORD (должен совпадать с корневым .env) и JWT_SECRET!" -ForegroundColor Yellow
}
if (-not (Test-Path 'backend\dist\main.js')) {
  Write-Host "  dist не найден — собираю backend (ошибки '@types/multer' косметические, сборка завершится)..." -ForegroundColor Yellow
  Push-Location backend
  npm run build
  Pop-Location
  if (-not (Test-Path 'backend\dist\main.js')) {
    Write-Host "  Сборка не дала dist — смотри ошибки выше." -ForegroundColor Red
    exit 1
  }
}

Write-Host "== 4/5 Запуск сервисов ==" -ForegroundColor Cyan
if (-not (Wait-Port 3001 'Backend' 1)) {
  Start-Process powershell -ArgumentList '-NoExit', '-Command', "cd '$root\backend'; npm run start:prod"
  if (-not (Wait-Port 3001 'Backend' 40)) {
    Write-Host "  Backend не поднялся. В его окне — причина. Частые: креды БД в backend\.env, занятый порт, отсутствие Node-зависимостей (npm ci)." -ForegroundColor Red
    exit 1
  }
}
if (-not (Wait-Port 3000 'Frontend' 1)) {
  Start-Process powershell -ArgumentList '-NoExit', '-Command', "cd '$root'; npm run dev"
  if (-not (Wait-Port 3000 'Frontend' 60)) {
    Write-Host "  Frontend не поднялся — смотри его окно (npm ci в корне, если ругается на отсутствие next)." -ForegroundColor Red
    exit 1
  }
}

Write-Host "== 5/5 Готово ==" -ForegroundColor Cyan
Write-Host "  Frontend: http://localhost:3000" -ForegroundColor Green
Write-Host "  Backend:  http://localhost:3001 (404 на / — это нормально, значит жив)" -ForegroundColor Green
Write-Host "  AI:       http://localhost:8000 (mock, если не настроен LM Studio в .env)" -ForegroundColor Green
