# CSSU Dock watchdog — reference configuration.
# Production path on the gaming PC: C:\ProgramData\CSSU\CssuDockWatchdog.ps1
# Run as the unprivileged Games account, in its interactive logon session.
# Do not run as SYSTEM or from an administrator's separate desktop session.
# This reference is not proof that the file is deployed to the PC.

$exe = 'C:\Program Files\CssuDock\CssuDock.exe'
$session = (Get-Process -Id $PID).SessionId

while ($true) {
    $running = Get-Process -Name 'CssuDock' -ErrorAction SilentlyContinue |
        Where-Object { $_.SessionId -eq $session }

    if (-not $running -and (Test-Path -LiteralPath $exe -PathType Leaf)) {
        try {
            Start-Process -FilePath $exe `
                -ArgumentList '--show' `
                -WorkingDirectory (Split-Path $exe)
        }
        catch {
            Write-Warning "CSSU Dock could not be started: $_"
        }
    }

    Start-Sleep -Seconds 5
}
