$packages = @(
    "Git.Git",
    "OpenJS.NodeJS.LTS",
    "Docker.DockerDesktop"
)

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host " Soyuz Messenger: Установка рабочего окружения" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

foreach ($pkg in $packages) {
    Write-Host "`n>>> Установка $pkg ..." -ForegroundColor Yellow
    winget install --id $pkg -e --source winget --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -eq 0) {
        Write-Host ">>> $pkg успешно установлен!" -ForegroundColor Green
    } else {
        Write-Host ">>> Ошибка или завершено с кодом $LASTEXITCODE" -ForegroundColor Red
    }
}

Write-Host "`n=============================================" -ForegroundColor Cyan
Write-Host " Установка завершена! Нажмите Enter для выхода..." -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Read-Host
