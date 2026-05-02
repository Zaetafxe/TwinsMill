param(
    [switch]$InstallDeps
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $root "backend"
$frontendDir = Join-Path $root "frontend"
$venvActivate = Join-Path $backendDir ".venv\Scripts\Activate.ps1"
$frontendPort = 3010

function Assert-Command {
    param([string]$Name)

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "No se encontro el comando '$Name' en PATH."
    }
}

function Start-InNewPowerShell {
    param(
        [string]$WorkingDirectory,
        [string]$Command
    )

    $escapedWorkingDirectory = $WorkingDirectory.Replace("'", "''")
    $fullCommand = "Set-Location '$escapedWorkingDirectory'; $Command"

    Start-Process powershell -ArgumentList @(
        "-NoExit",
        "-ExecutionPolicy", "Bypass",
        "-Command", $fullCommand
    ) | Out-Null
}

function Test-PortInUse {
    param([int]$Port)

    $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -First 1

    return $null -ne $listener
}

Write-Host "[TwinsMill] Verificando prerequisitos..." -ForegroundColor Cyan
Assert-Command -Name "py"
Assert-Command -Name "npm"

if (-not (Test-Path $backendDir)) {
    throw "No se encontro el directorio backend: $backendDir"
}

if (-not (Test-Path $frontendDir)) {
    throw "No se encontro el directorio frontend: $frontendDir"
}

if (-not (Test-Path $venvActivate)) {
    Write-Host "[TwinsMill] Creando entorno virtual en backend/.venv..." -ForegroundColor Yellow
    & py -3.11 -m venv (Join-Path $backendDir ".venv")
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $venvActivate)) {
        Write-Host "[TwinsMill] Python 3.11 no disponible. Reintentando con la version por defecto..." -ForegroundColor Yellow
        & py -m venv (Join-Path $backendDir ".venv")
    }

    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $venvActivate)) {
        throw "No fue posible crear backend/.venv. Verifica una instalacion de Python en el sistema."
    }
}

if ($InstallDeps) {
    Write-Host "[TwinsMill] Instalando dependencias de backend..." -ForegroundColor Yellow
    & powershell -ExecutionPolicy Bypass -Command "Set-Location '$backendDir'; . '.\.venv\Scripts\Activate.ps1'; pip install -r requirements.txt"

    Write-Host "[TwinsMill] Instalando dependencias de frontend..." -ForegroundColor Yellow
    & powershell -ExecutionPolicy Bypass -Command "Set-Location '$frontendDir'; npm install"
}

if (Test-PortInUse -Port 8000) {
    Write-Host "[TwinsMill] Backend ya esta escuchando en 8000. No se inicia otro proceso." -ForegroundColor Yellow
}
else {
    Write-Host "[TwinsMill] Iniciando backend en puerto 8000..." -ForegroundColor Green
    Start-InNewPowerShell -WorkingDirectory $backendDir -Command ". '.\.venv\Scripts\Activate.ps1'; uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
}

if (Test-PortInUse -Port $frontendPort) {
    Write-Host "[TwinsMill] Frontend ya esta escuchando en $frontendPort. No se inicia otro proceso." -ForegroundColor Yellow
}
else {
    Write-Host "[TwinsMill] Iniciando frontend en puerto $frontendPort..." -ForegroundColor Green
    Start-InNewPowerShell -WorkingDirectory $frontendDir -Command "npm run dev -- -p $frontendPort"
}

Write-Host "[TwinsMill] Servicios iniciados." -ForegroundColor Green
Write-Host "- Backend:  http://localhost:8000/docs"
Write-Host "- Frontend: http://localhost:$frontendPort"