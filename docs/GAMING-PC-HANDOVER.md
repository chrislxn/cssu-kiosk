# CSSU Gaming PC — Operations & Handover

**Recorded:** 2026-11-15  
**Owner:** Computer Science Student Union (CSSU), University of Toronto  
**Platform:** Windows 11 IoT Enterprise LTSC 2024  
**Device:** CSSU Lounge shared gaming PC

> **Scope:** This is the **Windows gaming PC**, **not** the Orange Pi digital-signage kiosk documented in this repository's [README](../README.md) and [SYSTEM.md](../SYSTEM.md). They are separate devices. This page is an operational handover, not a clean-install or security-certification guide.

## 1. Intended behavior and current status

The gaming PC should boot into the restricted local **Games** account and launch Steam Big Picture without showing the usual Windows Explorer desktop. A separate **CSSU-PC** administrator account retains normal desktop access for maintenance.

Status labels below distinguish observations from configurations that still require a live audit.

| Item | Last known status |
| --- | --- |
| Windows 11 IoT Enterprise LTSC 2024 | **Reported / observed** |
| Local accounts: CSSU-PC (administrator), Games (standard user) | **Confirmed during configuration** |
| Games automatic sign-in | **Reported working** |
| Games Shell Launcher → Steam watchdog → Big Picture | **Reported working** |
| Epic, Riot and GTA V Steam launch wrappers | **Reported working**, with possible focus issues |
| AppLocker: Games blocked from explorer.exe; admin and Steam allowed | **Tested**, and operator reported working |
| Games-only NoRun policy | **Needs live verification** |
| Games-only DisableTaskMgr policy | **Needs live verification** |
| Tailscale unattended setting | **Needs live verification** |
| eduroam after Games auto-login | **Reported usable**; reliability across user switches unverified |
| Admin RDP connection | **Connected after a reboot**; intermittent startup/session issue unresolved |
| OpenSSH Server recovery channel | **Proposed, not confirmed installed** |
| CSSU Dock executable | **Built**; Games user reportedly tested manual launch and closing with X |
| CSSU Dock scheduled task | **Created successfully**, initially shown as `Ready`; updated watchdog action and reboot behavior still need live verification |

## 2. Accounts and startup architecture

| Local account | Role | Shell |
| --- | --- | --- |
| `CSSU-PC` | Administrator; installation and recovery | Normal `explorer.exe` |
| `Games` | Standard user; public gaming | Custom Shell Launcher entry |

Games automatic sign-in is configured using **Microsoft Sysinternals Autologon**. Credentials are deliberately **not** in this repository.

```text
Windows boot
  ├─ Windows services (network, Tailscale if configured)
  └─ Automatic sign-in: Games
      └─ Windows Shell Launcher
          └─ powershell.exe → C:\ProgramData\CSSU\SteamWatchdog.ps1
              └─ C:\Program Files (x86)\Steam\steam.exe -gamepadui
```

Shell Launcher is the Windows optional feature `Client-EmbeddedShellLauncher`, configured through the `WESL_UserSetting` WMI class in `root\standardcimv2\embedded`. The recorded Games shell command is:

```powershell
powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "C:\ProgramData\CSSU\SteamWatchdog.ps1"
```

The recorded `DefaultAction = 0` asks Shell Launcher to restart its configured shell if that shell process exits. The watchdog itself is a long-running process: it checks for the Steam process **in its own Windows session**, launches `steam.exe -gamepadui` if absent, and checks again periodically.

**Important:** Shell Launcher changes which shell is started; it is **not** a security boundary and does not prevent all alternative ways to launch Windows applications.

## 3. Steam and third-party launchers

The operational scripts live on the **physical Windows PC** under:

```text
C:\ProgramData\CSSU\
  SteamWatchdog.ps1
  CssuDockWatchdog.ps1        (proposed / verify deployed)
  LaunchEpic.ps1
  LaunchRiot.ps1
  LaunchGTAV.ps1
  AppLocker-CSSU-Kiosk.xml       (candidate policy, if still present)
  AppLocker-backup-*.xml         (historical backups, if still present)
```

These file names and behavior are recorded from configuration sessions. **The actual latest source files have not yet been exported into this GitHub repository.** Read the files on the PC before editing or reimplementing them.

| Script | Purpose |
| --- | --- |
| `SteamWatchdog.ps1` | Relaunch Steam Big Picture if Steam exits in the Games session. |
| `LaunchEpic.ps1` | Start Epic Games Launcher and keep the Steam-launched wrapper alive while its UI process exists. |
| `LaunchRiot.ps1` | Start Riot Client and track Riot UI/game processes rather than only the first launcher process. |
| `LaunchGTAV.ps1` | Start GTA V Legacy through its existing launcher/batch process and wait for the GTA game process. |

Steam non-Steam shortcut pattern:

```text
Target:
"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"

Launch options (Epic example):
-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "C:\ProgramData\CSSU\LaunchEpic.ps1"
```

Use the matching `LaunchRiot.ps1` or `LaunchGTAV.ps1` file for those entries. The "Start In" path can differ by shortcut; inspect the existing entries before editing.

**Known limitation:** A wrapper helps Steam maintain a `Running / Stop` state but **does not guarantee foreground-window focus**. Epic, Riot or Rockstar-related windows may open behind Steam Big Picture. `Alt+Tab` has been the practical workaround.

## 4. AppLocker and Games restrictions

The final **EXE rule intent** is deliberately a minimal *deny exception*, not an application whitelist:

| Action | User / group | File path |
| --- | --- | --- |
| Allow | Everyone | `*` |
| Deny | Games (user SID) | `%WINDIR%\explorer.exe` |

AppLocker **Deny** takes precedence over **Allow**. The operator tested the candidate XML with `Test-AppLockerPolicy` and obtained:

- **Games → `C:\Windows\explorer.exe`: Denied**
- **CSSU-PC → `C:\Windows\explorer.exe`: Allowed**
- **Games → `C:\Program Files (x86)\Steam\steam.exe`: Allowed**

After applying the revised rules, the operator reported that the setup worked. Export the **effective** policy to confirm the current state rather than relying only on the old candidate XML.

The candidate policy also included a rule allowing all signed packaged applications and set the MSI, Script and DLL rule collections to **Audit only**. **Their effective states on the deployed PC need to be checked**. This matters because Windows Settings is a packaged application.

Other **Games-only** policy settings discussed:

- `NoRun = 1` in `...\Policies\Explorer` to remove Run/Run New Task entry points.
- `DisableTaskMgr = 1` in `...\Policies\System` to prevent Task Manager (including its "Search online" escape path).

These user registry settings were **recommended**, but there is no final command output in the handover proving that both are present. Check the actual **Games** user hive; do **not** write them into the administrator's `HKCU` by mistake. The Games hive under `HKEY_USERS\<SID>` may not be loaded when Games is fully signed out.

The system is intended to reduce casual misuse of a shared PC, **not** provide an unbreakable kiosk or security sandbox. Avoid granting Games administrator rights, storing account-recovery email sessions, or adding unrestricted application launchers.

## 5. Connectivity and remote administration

- **Physical uplink:** USB Wi-Fi adapter connecting to **eduroam** (802.1X / PEAP, user-authenticated).
- **Boot behavior:** Games automatic login should permit its saved wireless credentials to establish connectivity. A user switch may trigger 802.1X reauthentication. Both accounts still share one adapter and wireless network.
- **Tailscale:** Intended to operate as a Windows system service with unattended mode. **Verify** whether `tailscale set --unattended=true` was enabled and that the service starts automatically.
- **RDP:** Used for the CSSU-PC administrator's GUI access. A recent restart allowed a successful connection, but Mac Windows App has intermittently stopped at "Configuring remote PC…" even when TCP 3389 was reachable.
- **Recommended future improvement:** Enable and test Windows OpenSSH Server over Tailscale as a separate command-line recovery route. **Not confirmed deployed.**

An open TCP 3389 port does not establish that RDP authentication, user session creation or desktop initialization succeeded. The gaming PC must have a local-console recovery option before changing logon/session or application-control policies.

## 6. Operator checks (PowerShell)

Run these as **CSSU-PC administrator**. The commands in this section are inspection-oriented unless noted.

```powershell
# Current identity and local accounts
whoami
Get-LocalUser | Select-Object Name, Enabled, SID

# Script inventory; inspect exact current contents before editing
Get-ChildItem 'C:\ProgramData\CSSU' -Filter '*.ps1'
Get-Content 'C:\ProgramData\CSSU\SteamWatchdog.ps1'

# Inspect effective AppLocker policy (do not publish exports unreviewed)
Get-AppLockerPolicy -Effective -Xml

# Inspect recent executable blocks
Get-WinEvent -FilterHashtable @{
    LogName = 'Microsoft-Windows-AppLocker/EXE and DLL'
    Id = 8004
    StartTime = (Get-Date).AddHours(-1)
} -ErrorAction SilentlyContinue |
  Select-Object TimeCreated, Message

# Network and remote access
Get-Service Tailscale
& 'C:\Program Files\Tailscale\tailscale.exe' status
netsh wlan show interfaces
quser
```

Check the Windows Shell Launcher feature and class without changing state:

```powershell
Get-WindowsOptionalFeature -Online -FeatureName Client-EmbeddedShellLauncher
Get-CimClass -Namespace root\standardcimv2\embedded -ClassName WESL_UserSetting
```

Inspect Games-only policy values when its user registry hive is loaded:

```powershell
$gamesSid = (Get-LocalUser 'Games').SID.Value
$root = "Registry::HKEY_USERS\$gamesSid"
Get-ItemProperty "$root\Software\Microsoft\Windows\CurrentVersion\Policies\Explorer" -Name NoRun -ErrorAction SilentlyContinue
Get-ItemProperty "$root\Software\Microsoft\Windows\CurrentVersion\Policies\System" -Name DisableTaskMgr -ErrorAction SilentlyContinue
```

An absent `HKEY_USERS\<SID>` key may mean the user hive is **not loaded**, not that the policy has never been configured.

## 7. Recovery and change control

**Before modifying shell, AppLocker or authentication:**

1. Confirm administrator access and a local-console or other independently tested recovery route.
2. Export or back up the **current effective** configuration and the actual scripts.
3. Change one mechanism at a time; verify both the Games session and administrator session.
4. Never place credentials, session tokens, Tailnet keys or unredacted user/network exports in this **public** repository.

To inspect AppLocker policy before enforcement, use `Test-AppLockerPolicy` on candidate XML for **both Games and CSSU-PC**, including Steam and other relevant executable paths. Packaged-app behavior must also be checked. Retain the XML backup and its exact file path.

**Emergency Shell Launcher disable (changes live configuration; administrator only):**

```powershell
$sl = [wmiclass]"\\localhost\root\standardcimv2\embedded:WESL_UserSetting"
$sl.SetEnabled($false)
```

A sign-out or reboot may be needed for the normal Explorer shell to appear in subsequent Games logons. Re-enable only after inspecting the live per-user shell configuration.

**AppLocker rollback:** use a known-good, previously exported policy via `Set-AppLockerPolicy -XmlPolicy <verified-backup-path>`, then refresh policy and test. Do **not** guess the backup filename or blindly overwrite a newer policy.

## 8. CSSU Dock — interactive launch and unattended restart

The standalone CSSU Dock window switcher **has been built**, and the operator reported running it manually and being able to close it with the X button. Its automatic startup and watchdog recovery are being configured; **successful reboot and recovery tests have not been reported**.

The intended functionality:

- Bottom-edge Dock showing **only already-open, switchable top-level windows**.
- Click an entry to restore/activate its existing window.
- No application launch, Run New Task, file browser, pinned shortcuts or administration commands.
- Must work without `explorer.exe`; keep existing shell and policies untouched initially.
- It is a Windows executable; test actual Win32 foreground behavior on the production PC.
- Development and initial functional testing can use a remote Windows VM. **Final acceptance must occur on the real gaming PC**, because Steam Big Picture and full-screen games may behave differently in an RDP session.

**Executable and runtime contract:** `C:\Program Files\CssuDock\CssuDock.exe --show` runs persistently, displays the Dock for about ten seconds and then auto-hides; `--exit` deliberately exits it. **Do not use** `Test-Dock.cmd` for unattended startup because it quits after two minutes.

**Scheduled task:** `CSSU Dock`, triggered **At log on** of `CSSU-PC\Games`, principal `Interactive` and `Limited`. The user successfully ran `Register-ScheduledTask` and saw the task in `Ready` state. That confirms registration, **not that the task was later executed**. Its original action ran the executable directly. The intended final action runs `powershell.exe` with `C:\ProgramData\CSSU\CssuDockWatchdog.ps1` instead.

The reference source for that watchdog is committed at [`windows-gaming-pc/CssuDockWatchdog.ps1`](../windows-gaming-pc/CssuDockWatchdog.ps1). It polls every five seconds for a `CssuDock` process in **its own session**. If absent and the EXE exists, it launches `CssuDock.exe --show`. The watchdog must run inside the **Games interactive session**, not as `SYSTEM` or the administrator. It restarts after normal X-button exits as well as crashes, provided the watchdog itself is still running. The scheduled task is configured with no execution timeout, `IgnoreNew` for overlapping instances, and up to three failed-task restarts one minute apart (this last setting does not replace the watchdog).

### Provision / update the task

Run as administrator **only after confirming the reference watchdog was reviewed and deployed to** `C:\ProgramData\CSSU\CssuDockWatchdog.ps1` on the PC:

```powershell
$watchdog = 'C:\ProgramData\CSSU\CssuDockWatchdog.ps1'
if (-not (Test-Path -LiteralPath $watchdog)) { throw 'Watchdog script missing' }
$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$watchdog`"" `
    -WorkingDirectory 'C:\ProgramData\CSSU'
Set-ScheduledTask -TaskName 'CSSU Dock' -Action $action
(Get-ScheduledTask -TaskName 'CSSU Dock').Actions | Format-List *
```

For a new installation, create the task using the `Games` interactive principal and an `AtLogOn -User 'CSSU-PC\Games'` trigger. **Do not select** "Run whether user is logged on or not" or run GUI applications as `SYSTEM`.

### Verify and maintain

```powershell
Get-ScheduledTask -TaskName 'CSSU Dock' | Select-Object TaskName, State
Get-ScheduledTaskInfo -TaskName 'CSSU Dock' |
    Format-List LastRunTime, LastTaskResult, NumberOfMissedRuns
Get-CimInstance Win32_Process -Filter "Name = 'CssuDock.exe'" |
    Select-Object ProcessId, SessionId, CommandLine
```

Test: restart the PC, confirm automatic `Games` sign-in, verify Steam Big Picture and the Dock start in that interactive session, close the Dock with X, and verify it reappears in about five seconds. Test real full-screen game behavior locally; RDP is not sufficient. In the reported transcript the task was created but these final validations were **not** shown.

**Planned maintenance:** first stop the task and then terminate its existing watchdog process **in the Games session**, or the watchdog may immediately relaunch the Dock after `CssuDock.exe --exit`. Be careful: `Stop-ScheduledTask` acts on the scheduled task instance, but always confirm the watchdog process is actually gone before upgrading. Restart it with `Start-ScheduledTask -TaskName 'CSSU Dock'` while Games is signed in. If necessary disable the task for longer maintenance with `Disable-ScheduledTask -TaskName 'CSSU Dock'` and re-enable afterward.

**Recovery:** if automatic startup causes a problem, disable only the `CSSU Dock` scheduled task through the administrator account; do **not** change Shell Launcher, the Steam watchdog or AppLocker merely to disable the Dock.

Do not assume the Dock resolves all Steam focus issues or acts as a security boundary.

## 9. What the next maintainer / AI should do first

1. **Do not change working startup or policy configuration from this document alone.**
2. Read the **real** `C:\ProgramData\CSSU\*.ps1` files, Shell Launcher WMI settings, Steam shortcuts and exported effective AppLocker XML on the PC.
3. Confirm actual `NoRun`, `DisableTaskMgr`, Tailscale unattended and eduroam behavior after a cold boot and user switch.
4. Back up and redact actual configuration files before adding them to version control.
5. Verify the Dock scheduled-task action, watchdog process and recovery from X-button exits in the `Games` session, without modifying the production Steam shell.
6. Preserve an independently available administrator recovery channel.

**Source of truth priority:** live device state → current exported files and test output → this handover → older proposed commands.