# ============================================================
#  install-startup-task.ps1
#  Registers a Windows Scheduled Task that runs start-server.bat
#  at system startup (before/without login), with highest privileges.
#
#  Run once, in an ELEVATED PowerShell (Run as Administrator):
#     Set-ExecutionPolicy -Scope Process Bypass -Force
#     .\install-startup-task.ps1
# ============================================================

$ErrorActionPreference = "Stop"

$ProjectRoot = "E:\Programs\javed-iqbal-learning-platform\consultant-platform"
$BatPath     = Join-Path $ProjectRoot "windows\start-server.bat"
$TaskName    = "JIL-Platform-Startup"

if (-not (Test-Path $BatPath)) {
    throw "start-server.bat not found at $BatPath"
}

# Remove existing task with the same name (idempotent re-install)
if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "Removed existing task $TaskName"
}

$Action    = New-ScheduledTaskAction -Execute $BatPath
$Trigger   = New-ScheduledTaskTrigger -AtStartup
$Principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$Settings  = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Principal $Principal -Settings $Settings -Description "Starts Javed Iqbal Learning Platform (PM2 + Nginx) at Windows startup"

Write-Host ""
Write-Host "Scheduled task '$TaskName' installed. It will run at every startup."
Write-Host "Test it now with:  Start-ScheduledTask -TaskName '$TaskName'"
