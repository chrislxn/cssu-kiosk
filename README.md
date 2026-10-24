# CSSU Kiosk

**Digital signage system for the Computer Science Student Union (CSSU) at the University of Toronto.**

**For Frontend Dev Docs, See /frontend**

Visit our new office at BA2285@ Bahen Center !

A lightweight, offline-first digital signage platform designed to run continuously on an ARM64 single-board computer.

The system serves a locally hosted web application, displays it through Chromium, and retrieves updates automatically from GitHub Releases.

## 1. Project Overview

The CSSU Kiosk is designed to provide information and announcements to visitors of the CSSU Lounge without requiring constant manual maintenance.

### Design Goals

- **Offline-first:** Continue displaying locally stored content during internet outages.
- **Automatic updates:** Retrieve new content from GitHub Releases without manually accessing the device.
- **Reliability:** Recover from routine failures and support unattended operation.
- **Low maintenance:** Use standard Linux services and straightforward configuration.
- **Maintainability:** Allow future CSSU members to understand and operate the system.

## 2. Hardware and Software

| Component | Configuration |
|---|---|
| Device | Orange Pi 3B |
| SoC | Rockchip RK3566 |
| Memory | 4 GB RAM |
| Architecture | ARM64 / AArch64 |
| Operating system | Armbian, Debian-based |
| Observed kernel | Linux 6.18.57-current-rockchip64 |
| Browser | Chromium |
| Web server | Nginx |
| GPU | Mali-G52, Panfrost driver |
| Service management | systemd |
| Logging | systemd-journald |
| Update source | GitHub Releases |

The operating system and kernel versions describe the observed development environment, not mandatory requirements for all future deployments.

Confirm the running environment with:

```bash
cat /etc/os-release
uname -a
```

## 3. System Architecture

```text
GitHub Repository
       |
       | Publish release
       v
GitHub Releases
  └── kiosk.zip
       |
       | Periodic update check
       v
Orange Pi 3B
  |
  +-- systemd
  |    └── cssu-update.timer
  |         └── cssu-update.service
  |
  +-- /srv/cssu-kiosk/
  |    ├── releases/
  |    |    ├── v0.2/
  |    |    ├── v0.3/
  |    |    └── ...
  |    └── current -> releases/<version>
  |
  +-- Nginx
  |    └── Local HTTP server
  |
  +-- Chromium
  |    └── Digital signage display
  |
  +-- orangepi-temp.service
       └── CPU/GPU temperature logging
```

The application is served locally to avoid a dependency on continuous external network availability.

The updater, web server, and browser are separate components. A failure in the update-checking process should not require taking the existing local content offline.

## 4. Release and Deployment

### 4.1 Release Format

Application releases are published at:

https://github.com/chrislxn/cssu-kiosk/releases

Each deployment release should contain an asset named:

`kiosk.zip`

The archive should contain the web application files, including `index.html` at the archive root. Additional HTML, CSS, JavaScript, images, and other assets may be included.

The device installs releases under:

`/srv/cssu-kiosk/releases/<version>/`

The active deployment is referenced by:

`/srv/cssu-kiosk/current`

### 4.2 Automatic Updates

The GitHub Release updater is managed by two systemd units:

- `cssu-update.service` — runs the update check and installation process.
- `cssu-update.timer` — schedules update checks.

Check the update timer:

```bash
systemctl status cssu-update.timer
systemctl cat cssu-update.timer
systemctl list-timers --all
```

The original configuration used a 30-minute interval. The actual interval must be read from the installed timer, since it may be adjusted independently of the application.

Run an update check manually:

```bash
sudo systemctl start cssu-update.service
```

Inspect the updater logs:

```bash
journalctl -u cssu-update.service -n 100 --no-pager
```

Follow new logs:

```bash
journalctl -u cssu-update.service -f
```

Check the deployed version:

```bash
cat /srv/cssu-kiosk/current/version.txt
```

Inspect the current deployment:

```bash
ls -la /srv/cssu-kiosk/
readlink -f /srv/cssu-kiosk/current
```

### 4.3 Browser Refresh

The application includes support for detecting changes to the local deployed version.

The `version.txt` file can be used by client-side JavaScript to detect a newly deployed release and refresh the displayed content.

The exact refresh interval and service-worker configuration depend on the deployed application version.

### 4.4 Deployment Safety

For long-term unattended operation, the deployment system should preserve these properties:

1. Download the complete release before activating it.
2. Validate the downloaded archive before extraction.
3. Extract new files into a separate release directory.
4. Change the active deployment only after successful preparation.
5. Preserve a previous working release for recovery.
6. Keep the current display available when an update fails.

The above is the intended reliability contract; every safeguard should be verified against the installed updater before treating it as guaranteed.

## 5. Temperature Monitoring

The device exposes CPU and GPU temperature sensors through the Linux thermal subsystem.

The monitoring service is intended to collect both temperatures every 30 seconds and write measurements directly to systemd-journald.

**Service name:** `orangepi-temp.service`

**Executable:** `/usr/local/bin/orangepi-temp-monitor`

The configuration below documents the proposed implementation. Installation and successful operation should be confirmed on the actual device.

### 5.1 Monitoring Script

Create the executable:

```bash
sudo tee /usr/local/bin/orangepi-temp-monitor >/dev/null <<'EOF'
#!/bin/sh

while true; do
    output=""

    for zone in /sys/class/thermal/thermal_zone*; do
        [ -r "$zone/type" ] || continue
        [ -r "$zone/temp" ] || continue

        IFS= read -r name < "$zone/type"
        IFS= read -r temp < "$zone/temp"

        case "$temp" in
            ''|*[!0-9]*) continue ;;
        esac

        whole=$((temp / 1000))
        decimal=$(((temp % 1000) / 100))

        output="$output $name=${whole}.${decimal}C"
    done

    if [ -n "$output" ]; then
        echo "${output# }"
    else
        echo "No readable thermal sensors"
    fi

    sleep 30
done
EOF

sudo chmod 755 /usr/local/bin/orangepi-temp-monitor
```

The script enumerates available thermal zones rather than relying on fixed sensor indices.

### 5.2 systemd Service

Create `/etc/systemd/system/orangepi-temp.service`:

```ini
[Unit]
Description=Orange Pi Temperature Monitor

[Service]
Type=simple
ExecStart=/usr/local/bin/orangepi-temp-monitor
Restart=always
RestartSec=5
User=nobody
NoNewPrivileges=true
StandardOutput=journal
StandardError=journal
SyslogIdentifier=orangepi-temp

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now orangepi-temp.service
```

Verify its status:

```bash
systemctl status orangepi-temp.service
```

### 5.3 Temperature Logs

View live measurements:

```bash
journalctl -u orangepi-temp.service -f -o short-iso
```

View measurements from the last hour:

```bash
journalctl -u orangepi-temp.service \
  --since "1 hour ago"
```

View measurements from the current boot:

```bash
journalctl -u orangepi-temp.service -b
```

Example output:

```text
orangepi-temp: cpu-thermal=55.0C gpu-thermal=52.0C
orangepi-temp: cpu-thermal=63.0C gpu-thermal=58.0C
```

Log timestamps are supplied by journald.

### 5.4 Thermal Thresholds

The observed kernel configuration exposes the following thresholds for both CPU and GPU:

| Threshold | Temperature |
|---|---|
| Trip point 0 | 70°C |
| Trip point 1 | 75°C |
| Trip point 2 | 95°C |

These are configured kernel trip points. Their exact actions depend on the thermal zone trip types and cooling-device mappings.

Inspect the configuration:

```bash
for z in /sys/class/thermal/thermal_zone*; do
    echo "=== $(cat "$z/type") ==="
    grep -H . "$z"/trip_point_*_type 2>/dev/null
    grep -H . "$z"/trip_point_*_temp 2>/dev/null
done
```

Inspect thermal cooling states:

```bash
for c in /sys/class/thermal/cooling_device*; do
    echo "$(cat "$c/type"): \
$(cat "$c/cur_state")/$(cat "$c/max_state")"
done
```

A nonzero cooling state indicates a cooling device has been activated, but does not by itself identify the associated temperature or performance impact.

### 5.5 Observed Temperature Behaviour

During initial testing:

| Operating condition | Approximate CPU temperature |
|---|---|
| Browser active, fan disabled | 70°C |
| Browser active, fan enabled | 63°C |
| Low activity, fan enabled | 55°C |

An active browser session with the fan enabled also showed approximately 58°C GPU temperature.

These readings were observations under varying workloads, not controlled thermal benchmarks.

For continuous operation, active cooling is recommended where practical.

## 6. Persistent System Logs

The system uses systemd-journald for service logs.

To retain logs across reboots, configure persistent journal storage.

Create `/etc/systemd/journald.conf.d/10-persistent.conf`:

```ini
[Journal]
Storage=persistent
SystemMaxUse=100M
```

Apply the configuration:

```bash
sudo mkdir -p /etc/systemd/journald.conf.d
sudo mkdir -p /var/log/journal

sudo systemctl restart systemd-journald
sudo journalctl --flush
```

**Important:** `SystemMaxUse=100M` applies to the entire persistent system journal, not only the temperature-monitoring service.

Check disk usage:

```bash
journalctl --disk-usage
```

Check logs from previous boots:

```bash
journalctl --list-boots
```

Journal retention is subject to available disk space and the configured retention limits.

## 7. Routine Maintenance

### Check System Health

```bash
uptime
free -h
df -h
```

### Check Web Server

```bash
systemctl status nginx
sudo nginx -t
```

### Check Automatic Updates

```bash
systemctl status cssu-update.timer
journalctl -u cssu-update.service -n 50
```

### Check Temperatures

```bash
systemctl status orangepi-temp.service
journalctl -u orangepi-temp.service -n 20
```

### Check Installed Application Version

```bash
cat /srv/cssu-kiosk/current/version.txt
```

### Check Chromium GPU Acceleration

Open the following page in Chromium:

`chrome://gpu`

The initial graphical testing reported hardware acceleration enabled for compositing, Canvas, rasterization, WebGL, WebGPU, and video decode.

The reported GPU-rendering backend should be inspected separately to distinguish real Mali/Panfrost acceleration from software rendering fallbacks.

## 8. Troubleshooting

| Problem | Initial investigation |
|---|---|
| Display is blank | Check HDMI output, display mode, Chromium session and Nginx |
| Display shows old content | Check local version, update logs and browser cache |
| Update did not install | Inspect `cssu-update.service` logs |
| Timer not running | Inspect `cssu-update.timer` status and schedule |
| Temperature remains high | Check fan operation, ventilation and CPU/GPU load |
| Temperature logs are missing | Inspect `orangepi-temp.service` status |
| Logs disappear after reboot | Verify persistent journald configuration |
| Browser scrolling is slow | Check GPU renderer, display resolution, system load and thermal throttling |

Before performing a major system upgrade, verify compatibility with the Rockchip kernel, GPU drivers, display configuration and bootloader.

## 9. Security and Reliability

The kiosk is intended to operate with minimal network exposure.

Recommended operating practices:

- Serve kiosk content locally.
- Avoid exposing unnecessary services to the public internet.
- Use SSH keys for remote administration.
- Keep release downloads on HTTPS.
- Validate release contents before activation.
- Preserve previous releases for recovery.
- Restrict update-service filesystem permissions.
- Never commit SSH keys, credentials or access tokens to the repository.
- Review OS upgrades separately from kiosk content updates.

The device should continue displaying the last successfully deployed content when GitHub is unreachable.

## 10. Documentation and Known Gaps

At the initial documentation stage, the GitHub repository contains its README and license, while application builds are distributed as GitHub Release assets.

For long-term maintainability, the following work remains important:

- Commit the maintained application source code to the repository.
- Version-control the systemd service and timer definitions.
- Version-control the release updater implementation.
- Document the actual Chromium launch service and display configuration.
- Test automatic recovery from power loss.
- Test incomplete downloads and rollback behaviour.
- Confirm temperature monitoring survives a reboot.
- Establish a repeatable clean-install procedure.
- Record required hardware accessories and power specifications.

Avoid relying on undocumented configuration that exists only on the deployed device.

## 11. Project Maintenance

Maintained for the **Computer Science Student Union (CSSU)** at the **University of Toronto**.

Repository: https://github.com/chrislxn/cssu-kiosk

Releases: https://github.com/chrislxn/cssu-kiosk/releases

Issues: https://github.com/chrislxn/cssu-kiosk/issues

### License

The repository is licensed under the MIT License. Third-party assets and dependencies may have separate license requirements.
