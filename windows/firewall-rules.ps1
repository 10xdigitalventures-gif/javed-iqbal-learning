# ============================================================
#  firewall-rules.ps1
#  Opens the Windows Firewall ports needed for the platform.
#  Run once in an ELEVATED PowerShell (Run as Administrator):
#     Set-ExecutionPolicy -Scope Process Bypass -Force
#     .\firewall-rules.ps1
# ============================================================

$ErrorActionPreference = "Stop"

function Open-Port($name, $port) {
    if (Get-NetFirewallRule -DisplayName $name -ErrorAction SilentlyContinue) {
        Write-Host "Rule already exists: $name"
        return
    }
    New-NetFirewallRule -DisplayName $name -Direction Inbound -Action Allow -Protocol TCP -LocalPort $port | Out-Null
    Write-Host "Opened inbound TCP $port  ($name)"
}

# Public web traffic (needed for the reverse proxy + SSL)
Open-Port "JIL HTTP 80"  80
Open-Port "JIL HTTPS 443" 443

# Optional: direct LAN access to the raw services for debugging.
# Comment these out if you only want traffic through Nginx.
Open-Port "JIL Web 3000"        3000
Open-Port "JIL API 4000"        4000
Open-Port "JIL Marketplace 3001" 3001

Write-Host ""
Write-Host "Firewall rules applied. Verify with:  Get-NetFirewallRule -DisplayName 'JIL*'"
