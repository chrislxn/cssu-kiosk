# CSSU Kiosk: System Setup, Operations, and Recovery

> **Project:** CSSU Kiosk (also called CSSU Digital Signage)  
> **Organization:** Computer Science Student Union (CSSU), University of Toronto  
> **Repository:** https://github.com/chrislxn/cssu-kiosk  
> **Document scope:** Hardware, boot, operating system, graphics, networking, security, local hosting, deployment, systemd automation, logs, and recovery.  
> **Out of scope:** Visual design, UI components, animation rules, typography, and other frontend design standards. These are documented separately.  
> **Record assembled:** 2026-10-24

**Important:** "CSSU Kiosk" and "CSSU Digital Signage" refer to the **same project and device**, not two separate installations. The word *kiosk* is the project's working name; its function is digital signage.

This is both an engineering history and an operator runbook. It combines the earlier Armbian/graphics investigation with the later working signage deployment. Some information records an earlier point in time, so it must not be mistaken for the current disk state.

## Contents

1. [Evidence conventions and safety](#1-evidence-conventions-and-safety)
2. [Project overview and operational architecture](#2-project-overview-and-operational-architecture)
3. [Hardware and system inventory](#3-hardware-and-system-inventory)
4. [Installation history and Armbian V2.1 boot repair](#4-installation-history-and-armbian-v21-boot-repair)
5. [Boot configuration and kernel maintenance](#5-boot-configuration-and-kernel-maintenance)
6. [Wayland, Cage, Chromium, and display configuration](#6-wayland-cage-chromium-and-display-configuration)
7. [GPU and video-decoding verification](#7-gpu-and-video-decoding-verification)
8. [Networking, SSH, Tailscale, and Fail2Ban](#8-networking-ssh-tailscale-and-fail2ban)
9. [Local Nginx server and kiosk startup](#9-local-nginx-server-and-kiosk-startup)
10. [GitHub Release updater and client refresh](#10-github-release-updater-and-client-refresh)
11. [Scheduled services and timers](#11-scheduled-services-and-timers)
12. [Temperature, cooling, and monitoring](#12-temperature-cooling-and-monitoring)
13. [Journald retention and diagnostic logs](#13-journald-retention-and-diagnostic-logs)
14. [Package sources and software updates](#14-package-sources-and-software-updates)
15. [Routine operating procedures](#15-routine-operating-procedures)
16. [Failure recovery and troubleshooting](#16-failure-recovery-and-troubleshooting)
17. [Read-only inventory and configuration export](#17-read-only-inventory-and-configuration-export)
18. [Known gaps and acceptance tests](#18-known-gaps-and-acceptance-tests)
19. [Provenance and change history](#19-provenance-and-change-history)

---

## 1. Evidence conventions and safety

This document deliberately distinguishes *what actually ran* from *what was discussed*.

| Label | Meaning |
|---|---|
| **Verified in session** | The operator supplied console, log, screenshot, or command output demonstrating a successful result at that time. |
| **Historically reported** | The setup or value was recorded in an earlier conversation, but its current on-disk state has not been rechecked. |
| **Reference implementation** | A documented configuration suitable for review or installation, **not** a byte-for-byte copy of a known running file. |
| **Proposed / unverified** | Discussed or supplied as instructions, with no subsequent successful-installation evidence. |
| **Needs live audit** | Cannot be reliably decided from chat records; read the device's actual configuration before asserting it. |

### 1.1 Safety rules

- **Do not blindly flash a block device.** Confirm which device is the eMMC and which is the microSD on each boot using `lsblk` and `findmnt`.
- **Do not replace a working kernel or bootloader without a recovery path.** The board required device-tree troubleshooting to reach its current state.
- **Do not treat the early and late installation records as simultaneous.** They refer to different stages of this one project.
- **Do not disable SSH host-key verification** when the OS is reinstalled. Check the new fingerprint through a trusted local console before accepting it.
- **Do not commit raw private data.** Audit exports may reveal Wi-Fi credentials, Tailscale identities, private IP addresses, SSH keys, release tokens, or service secrets. Redact before putting anything in this public repository.
- Commands labeled *inspect* only read state. Commands labeled *install*, *change*, or *restart* alter it. Apply changing commands to the intended device and preferably during a maintenance window.

### 1.2 Current-state priority

When records conflict, use this order:

1. A fresh read of the live host (`systemctl cat`, `cat /etc/os-release`, file contents, and service journals).
2. The most recent successful operator output.
3. Older operator output.
4. Earlier assistant instructions and proposed scripts.

For example, an early record says Cage/Chromium was not yet a systemd service; later records show `cssu-kiosk.service` installed and enabled. These are successive stages, not evidence of two machines.

---

## 2. Project overview and operational architecture

The CSSU Kiosk provides a dedicated digital-signage display in or near the CSSU Lounge. The application is a locally hosted web page shown by Chromium in a dedicated Wayland compositor. The host periodically checks GitHub Releases for new assets, installs them in a versioned directory, and serves the selected version locally.

### 2.1 Goals

- Keep the display available when the network or GitHub is temporarily unreachable.
- Make updating published content possible without visiting the device.
- Minimize GUI overhead on a resource-constrained ARM board.
- Avoid a permanently exposed public web service.
- Automatically start the signage application after boot.
- Keep operational diagnostics in `systemd-journald`.
- Make future maintenance and disaster recovery reproducible by a new CSSU maintainer.

The offline-first objective is **partially demonstrated** by serving deployed files locally. Full offline behavior still requires a disconnected-network test: external page dependencies or remote fonts may cause visible degradation.

### 2.2 Architecture

```text
                    GitHub: chrislxn/cssu-kiosk
                               |
                         GitHub Releases
                          (kiosk.zip)
                               |
                cssu-update.timer (schedule)
                               |
                  cssu-update.service
                               |
                 /usr/local/bin/cssu-update
                               |
            verify, unpack, and stage a version
                               |
             /srv/cssu-kiosk/releases/<tag>/
                               |
                  atomic current switch
                               |
              /srv/cssu-kiosk/current -> ...
                               |
                    nginx (localhost only)
                     127.0.0.1:8080
                               |
               Cage (Wayland) + Chromium
                               |
                         HDMI display

  Other host functions:
    ssh / tailscale / fail2ban
    systemd startup / daily maintenance timers
    journald / temperature monitor (installation status to audit)
```

### 2.3 Key paths and identities

| Path or unit | Purpose | Evidence |
|---|---|---|
| `/srv/cssu-kiosk/releases/` | Installed version directories | Historically reported |
| `/srv/cssu-kiosk/current` | Active deployment symlink | Verified by `version.txt` read during OTA tests |
| `/srv/cssu-kiosk/current/version.txt` | Active deployed version | Verified: `v0.2`, later `v0.3` |
| `/usr/local/bin/cssu-update` | GitHub Release updater | Historically reported; exact final source needs export |
| `/etc/nginx/sites-available/cssu-kiosk` | Local HTTP virtual host | Historically reported |
| `cssu-kiosk.service` | Production display session | Later reported enabled/running |
| `/etc/pam.d/cssu-kiosk` | PAM session integration for display service | Historically reported |
| `/home/cssu/.local/share/cssu-signage/chromium` | Production Chromium profile | Historically reported |
| `/home/cssu/kiosk.sh` | Earlier interactive graphics/debug launcher | Created and tested |
| `/etc/fail2ban/jail.d/sshd.local` | SSH brute-force protection | Verified configuration load |
| `/usr/local/bin/orangepi-temp-monitor` | Temperature logger | Proposed; not yet proven installed |

**Name warning:** A development prompt once used `orangepi@orangepi3b`, while a later build was named `cssu-kiosk` with the `cssu` user. Resolve the current hostname and user from the actual host instead of hardcoding historical prompts into scripts.

---

## 3. Hardware and system inventory

### 3.1 Observed hardware

| Item | Recorded value |
|---|---|
| Board | Orange Pi 3B **V2.1** |
| SoC | Rockchip RK3566 |
| CPU | 4 x Cortex-A55 |
| GPU | ARM Mali-G52 |
| RAM | 4 GB (approximately 3.83 GiB usable in observed session) |
| eMMC | 64 GB nominal, approximately 58.3 GiB reported |
| Test microSD | SanDisk Creator 256 GB, V30/A2 (approximately 238.4 GiB reported) |
| SPI NOR | 16 MB |
| Display | HDMI; tested successfully at 1920 x 1080 |
| Cooling | Fan available; observed active/idle thermal improvements |

The historical storage map was:

```text
/dev/mmcblk0    58.3G     eMMC
/dev/mmcblk1   238.4G     microSD
/dev/mtd0        16MB     SPI NOR
```

**Do not assume these `/dev` names remain constant** after changes to the kernel, boot medium, or attached storage.

Inspect a live machine:

```bash
hostnamectl
cat /etc/os-release
uname -a
lsblk -o NAME,SIZE,FSTYPE,MOUNTPOINTS,MODEL
findmnt -no SOURCE /
```

### 3.2 OS version history, not a single immutable specification

The imported earlier debugging record documents a **successful Armbian 26.11 Rolling / Debian 13 Trixie boot** with `Linux 6.18.57-current-rockchip64` after selecting the V2.1 DTB. It also documents Chromium 156 and Mesa 25.0.7.

In a later package-management terminal session, `apt` used **Debian 12 Bookworm** repositories, including a Huawei Cloud Docker CE mirror. Both observations are real records for this project, but no complete installation timeline explains the discrepancy. They **must not** be presented as one simultaneously confirmed OS version.

**Before repeating installation commands**, check `/etc/os-release` and APT configuration on the current root filesystem. Use the matching distribution codename (`trixie` or `bookworm`) for package sources; never blindly copy a Bookworm repository into Trixie.

### 3.3 Storage placement remains a validation item

An Armbian session later showed a root filesystem around 57 GB, consistent with eMMC, but the original conversation did not retain a complete final installation command or a definitive no-SD-card boot transcript. Therefore:

- Successful Armbian boot: **verified in session**.
- The exact final eMMC flashing procedure: **not fully preserved**.
- Booting from eMMC with microSD removed: **needs live audit**.

---

## 4. Installation history and Armbian V2.1 boot repair

**This section is historical repair procedure, not a generic supported flashing guide.** It records the specific fix that enabled the observed Orange Pi 3B V2.1 to boot a newer Armbian build.

### 4.1 Initial failure

The official older Orange Pi image used:

```text
5.10.160-rockchip-rk356x
```

Several newer images, including Vendor 6.1-based candidates, failed or stalled at the splash screen. In some failures the keyboard powered on and `Ctrl+Alt+Delete` had an effect, but HDMI did not provide enough detail to localize the boot failure. Storage/media tests did not support blaming every failure on the SD card.

The eventual successful result establishes that **this board can run a newer mainline-style Linux stack** with an appropriate image/configuration. It does not prove that all Orange Pi 3B V2.1 devices share one identical failure cause.

### 4.2 Inspect the Armbian image

The test image was downloaded and decompressed:

```bash
xz -dk armbian.img.xz
```

Mount a copy read-only for inspection (on a Linux staging machine):

```bash
sudo losetup --read-only --find --show --partscan armbian.img
# Example result: /dev/loop0
sudo mkdir -p /mnt/armbian
sudo mount -t ext4 -o ro,noload /dev/loop0p1 /mnt/armbian
find /mnt/armbian/boot -type f -name '*orangepi*3b*.dtb' | sort
```

The image supplied **both**:

```text
rk3566-orangepi-3b-v1.1.dtb
rk3566-orangepi-3b-v2.1.dtb
```

However, `/boot/armbianEnv.txt` did not explicitly select a `fdtfile` in that image.

Unmount when finished:

```bash
sudo umount /mnt/armbian
sudo losetup -d /dev/loop0
```

### 4.3 Applied V2.1 DTB fix

A disposable image copy was used, preserving the downloaded original:

```bash
cp armbian.img armbian-v21-test.img
LOOP=$(sudo losetup -fP --show armbian-v21-test.img)
sudo mkdir -p /mnt/armbian-test
sudo mount "${LOOP}p1" /mnt/armbian-test
```

The successful change was to explicitly choose the V2.1 device tree:

```bash
printf '\nfdtfile=rockchip/rk3566-orangepi-3b-v2.1.dtb\n' \
  | sudo tee -a /mnt/armbian-test/boot/armbianEnv.txt
```

For troubleshooting visibility, verbosity was raised:

```bash
sudo sed -i 's/^verbosity=.*/verbosity=7/' \
  /mnt/armbian-test/boot/armbianEnv.txt
```

The observed boot configuration included the following **relevant** values:

```ini
verbosity=7
bootlogo=false
console=both
extraargs=cma=256M
overlay_prefix=rockchip-rk3566
rootfstype=ext4
fdtfile=rockchip/rk3566-orangepi-3b-v2.1.dtb
```

There was also a `rootdev=UUID=...` entry, **specific to that image**. Do not copy its UUID into a new installation; preserve or regenerate the UUID appropriate to the actual filesystem.

Finish modifying the image:

```bash
sync
sudo umount /mnt/armbian-test
sudo losetup -d "$LOOP"
```

**Cautions:**

- The `tee -a` operation was appropriate for the historical image because no `fdtfile` was set. On a different image, **inspect first**: avoid two competing `fdtfile=` lines.
- This procedure changes the boot configuration inside an image file, not the running host's boot settings.
- Do not image a raw block device until its identity has been independently checked.

### 4.4 Successful result

The modified image entered Armbian first-run initialization and showed:

```text
Welcome to Armbian community
Debian stable (trixie)
Linux 6.18.57-current-rockchip64
```

**Conclusion supported by the evidence:** explicitly selecting the V2.1 DTB fixed booting for the tested image/board combination. A general upstream root-cause determination remains unproven.

---

## 5. Boot configuration and kernel maintenance

### 5.1 Important boot artifacts

| Path | Purpose |
|---|---|
| `/boot/armbianEnv.txt` | Kernel and boot parameters; selects `fdtfile` |
| `/boot/boot.cmd` | U-Boot script source, if present |
| `/boot/boot.scr` | Generated U-Boot boot script, if present |
| `/boot/dtb/` | Device-tree files |
| `/boot/Image` | Linux kernel image or link |
| `/boot/uInitrd` | Initramfs image |

The earlier investigation of U-Boot startup verified that the Armbian boot logic uses `fdtfile` to identify the device tree to load.

Inspect safely:

```bash
cat /boot/armbianEnv.txt
find /boot/dtb -iname '*orangepi*3b*' -o -iname '*rk3566*' | head -n 40
readlink -f /boot/Image
```

### 5.2 Kernel update freeze

The historical session included these `armbian-config` commands:

```bash
sudo armbian-config --cmd UPD002
sudo armbian-config --cmd STABLE
```

A later boot screen showed `Kernel upgrade disabled`, supporting that the kernel-upgrade restriction took effect at that point. The change to a *stable Armbian software channel* was **not** independently verified.

The CLI syntax and channel names may change between Armbian releases; do not rerun the commands blindly. Verify the currently installed OS and upgrade-hold state first:

```bash
apt-mark showhold
apt list --installed 2>/dev/null | grep -E 'armbian|linux-image|linux-dtb' || true
```

**Operating policy:** Treat Debian userland updates and Armbian kernel/bootloader updates as different risk classes. Maintain a bootable recovery image before changing the kernel, DTB, bootloader, or root storage layout.

### 5.3 Unimplemented boot-related proposals

The following was discussed as a possible persistent HDMI mode, **not demonstrated as installed**:

```ini
extraargs=cma=256M video=HDMI-A-1:1920x1080@60
```

The proposed power-key override was also **unverified**:

```ini
# /etc/systemd/logind.conf.d/90-signage-powerkey.conf
[Login]
HandlePowerKey=ignore
```

A mechanical interference was observed between the board's physical power button and the surrounding case. Software cannot necessarily prevent hardware-level long-press power cutoff; mechanical clearance remains the more robust solution.

---

## 6. Wayland, Cage, Chromium, and display configuration

### 6.1 Reason for the chosen stack

The project chose **Cage + Chromium on Wayland**, rather than a full GNOME/KDE desktop, to minimize background overhead and automatically devote the screen to the signage page.

```text
Debian/Armbian minimal OS
       |
   Wayland + Cage
       |
     Chromium
       |
  Local signage URL
```

The previously installed packages included:

```bash
sudo apt install -y \
  chromium cage dbus-daemon fonts-liberation fonts-noto-cjk
```

For diagnostics and resolution control:

```bash
sudo apt install -y mesa-utils wlr-randr
```

Versions observed in the earlier Armbian Trixie session:

```text
Chromium 156.0.8078.47
Cage 0.2.0
Mesa 25.0.7
```

### 6.2 What failed during interactive setup

- Chromium launched as `root` returned: `Running as root without --no-sandbox is not supported`.
- Cage launched from an ordinary SSH session returned: `Could not open target tty: Permission denied`.
- Interactive testing succeeded when logging in as the unprivileged `cssu` user on the **physical HDMI/TTY console**.

The production service later used a separate PAM/TTY-aware systemd configuration. Therefore, the debugging launcher below is **not** the complete production autostart solution.

### 6.3 Historical interactive launcher

A script at `/home/cssu/kiosk.sh` was created and repeatedly revised while testing `https://www.google.com/`, `chrome://gpu`, user profiles, and temporary browser flags. A backup `/home/cssu/kiosk.sh.bak` was also created; it is not guaranteed to represent the earliest version.

The following is a **reference reconstruction from a successful interactive configuration**, not a claim of byte-identical final disk contents:

```sh
#!/bin/sh
URL="${1:-https://www.google.com/}"

exec dbus-run-session -- cage -s -- \
  chromium \
  --user-data-dir="$HOME/.config/cssu-kiosk-gpu-test" \
  --ozone-platform=wayland \
  --no-first-run \
  --no-default-browser-check \
  --disable-session-crashed-bubble \
  "$URL"
```

This version intentionally omits `--kiosk` to expose the browser UI while debugging. The production instance uses kiosk-style startup and a **different** user-data directory:

```text
/home/cssu/.local/share/cssu-signage/chromium
```

Inspect the real launcher and service before updating them:

```bash
sudo sed -n '1,240p' /home/cssu/kiosk.sh
sudo systemctl cat cssu-kiosk.service
```

### 6.4 Display mode

The historical test brought the output to **1920 x 1080**. `chrome://gpu` later displayed a 1080p resolution, which confirms that mode in the test session, but the record did not conclusively prove persistence across a reboot.

When executed from a session with valid Wayland environment variables:

```bash
wlr-randr
wlr-randr --output HDMI-A-1 --mode 1920x1080
```

`HDMI-A-1` is an observed/example output name, **not** a universal guarantee. The device must be running an active Cage/Wayland session, and the CLI needs access to that session's `WAYLAND_DISPLAY` and `XDG_RUNTIME_DIR`.

### 6.5 Production display service (later stage)

The later project state includes an enabled, running `cssu-kiosk.service` with these **historically reported properties**:

- Runs the signage session as unprivileged user `cssu`.
- Integrates `PAMName=cssu-kiosk` using `/etc/pam.d/cssu-kiosk`.
- Uses TTY1, including `TTYPath=/dev/tty1`.
- Conflicts with `getty@tty1.service` to prevent two processes competing for the console.
- Starts Cage + Chromium against the locally served page at `http://127.0.0.1:8080/`.
- Uses a dedicated Chromium user-data directory.

**Do not publish an invented exact unit body.** Recover the actual configuration:

```bash
sudo systemctl cat cssu-kiosk.service
sudo cat /etc/pam.d/cssu-kiosk
systemctl show cssu-kiosk.service -p User -p Group -p ExecStart -p Restart -p ActiveState
```

The service's complete environment, dependencies, and restart policy are **pending live export**.

---

## 7. GPU and video-decoding verification

### 7.1 Mali-G52 / Panfrost: working

The mainline GPU driver was not just assumed to be working; it was verified using several methods:

```bash
lsmod | grep -i panfrost
readlink -f /sys/class/drm/renderD128/device/driver
sudo eglinfo -B
```

Observed output included:

```text
panfrost
gpu_sched
drm_shmem_helper
/sys/bus/platform/drivers/panfrost
mali-g52 id 0x7402
Initialized panfrost 1.4.0
OpenGL ES profile renderer: Mali-G52 r1 (Panfrost)
```

The Chromium GPU process was also observed opening `/dev/dri/renderD128` and loading Mesa Gallium. In `chrome://gpu`, the tested build reported:

| Capability | Reported result |
|---|---|
| Canvas | Hardware accelerated |
| Compositing | Hardware accelerated |
| Rasterization | Hardware accelerated |
| WebGL | Hardware accelerated |
| WebGPU | Hardware accelerated |
| OpenGL | Enabled |
| GPU process crashes | 0 in the observed report |
| Vulkan | Disabled |
| Video encode | Software only |

The ANGLE/Mesa renderer reported **Mali-G52 r1 (Panfrost), OpenGL ES 3.1**. This is positive evidence of actual GPU rendering, rather than merely assuming acceleration from the presence of a Mali GPU on the board.

### 7.2 GPU acceleration is not the same as Chromium video hardware decoding

Despite `chrome://gpu` advertising video-decode support, the observed H.264 playback in `chrome://media-internals` reported:

```text
kVideoDecoderName: FFmpegVideoDecoder
kIsPlatformVideoDecoder: false
```

A temporary experimental Chromium flag:

```text
--enable-features=AcceleratedVideoDecoder
```

**did not change** those results and should not be listed as a demonstrated fix.

At times the test showed high system load (approximately `3.94` load average, ~`10.7%` CPU idle, a Chromium renderer process briefly reaching `263%` CPU). Memory pressure was not the primary observed limitation; swap was unused.

### 7.3 RKVDEC works through GStreamer

The installed inspection tools included:

```bash
sudo apt install -y \
  v4l-utils gstreamer1.0-tools gstreamer1.0-plugins-bad
```

The observed video devices were:

| Device | Driver | Role |
|---|---|---|
| `/dev/video0` | `rockchip-rga` | Image conversion/acceleration |
| `/dev/video1` | `rkvdec` | H.264/H.265 hardware decoder |
| `/dev/video2` | `hantro-vpu` | MPEG-2/VP8 decode |
| `/dev/video3` | `hantro-vpu` | Video encoder |

The `v4l2slh264dec` element was present and mapped to `/dev/video1`. The historical test pipeline was:

```bash
time gst-launch-1.0 -v \
  filesrc location="$HOME/test-1080p.mp4" ! \
  qtdemux ! \
  h264parse ! \
  v4l2slh264dec ! \
  fakesink sync=false
```

It completed on a 1920 x 1080, 30 fps H.264 High Profile sample with `Got EOS from element "pipeline0"`, reporting roughly `4.962s` elapsed. This is **evidence of a functioning hardware decode path in GStreamer**, not proof that Chromium uses the same path or that it is categorically faster in every workload.

**Project decision:** Keep the signage primarily HTML/CSS/images/light animation rather than making browser hardware-video decode a prerequisite. The frontend design standards are maintained separately.

---

## 8. Networking, SSH, Tailscale, and Fail2Ban

### 8.1 Networking and remote administration

The project used local networking, SSH, and Tailscale. A later Armbian login display included a Tailscale address. The precise Wi-Fi provisioning sequence was not preserved and must be checked on the live device.

Useful diagnostics:

```bash
ip -br addr
ip route
hostnamectl
tailscale status
systemctl status ssh --no-pager
```

Avoid embedding private LAN/Tailscale addresses or login identities in a public README.

### 8.2 SSH host-key change after reinstallation

A macOS client warned that the host key for a previously used LAN IP had changed. This is expected after generating new host keys during an OS reinstall, but the warning also protects against a possible impersonation attack.

On the **device's trusted local console**, print its key fingerprint:

```bash
ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

On the client, remove only the stale record for the actual device address:

```bash
ssh-keygen -R <device-ip>
ssh <username>@<device-ip>
```

Accept the new key **only after the fingerprint matches**. Do not disable `StrictHostKeyChecking`.

### 8.3 Fail2Ban configuration

The earlier security setup installed Fail2Ban and nftables:

```bash
sudo apt install -y fail2ban nftables
```

The operator supplied the actual contents of `/etc/fail2ban/jail.d/sshd.local`:

```ini
[sshd]
enabled = true
backend = systemd
port = ssh

maxretry = 5
findtime = 10m
bantime = 1h

ignoreip = 127.0.0.1/8 ::1 100.64.0.0/10
```

The historical session verified a successful configuration test and a loaded `sshd` jail:

```bash
sudo fail2ban-client -t
sudo systemctl enable --now fail2ban
sudo fail2ban-client status sshd
```

Observed result: `OK: configuration test is successful`; an `sshd` journal matcher was present, and no IPs were banned at that point.

**Important security caveats:**

- The original `ignoreip` exempts the entire `100.64.0.0/10` CGNAT/Tailscale address range, not just trusted administrator machines. Reassess whether that broad exclusion is necessary.
- A successful jail status does **not** prove that a deliberate failed-login test would trigger and enforce nftables blocking. The enforcement test is still pending.
- No evidence establishes that inbound SSH has been restricted exclusively to a private interface or Tailscale. Verify firewall rules before making that claim.

Audit:

```bash
sudo fail2ban-client status sshd
sudo nft list ruleset
sudo systemctl status fail2ban --no-pager
```

### 8.4 Physical power button

The case was found to press against the Orange Pi power button, risking accidental shutdown from a touch or flex of the panel. The proposal to use `HandlePowerKey=ignore` was **not confirmed installed**. Prefer correcting mechanical clearance; a software setting cannot necessarily override hardware shutdown behavior.

---

## 9. Local Nginx server and kiosk startup

### 9.1 Nginx

The later deployment includes Nginx enabled with a site file reported at:

```text
/etc/nginx/sites-available/cssu-kiosk
```

Its important historical settings were:

```text
listen: 127.0.0.1:8080
web root: /srv/cssu-kiosk/current
```

Binding to `127.0.0.1` makes this web listener reachable locally on the device, rather than exposing it directly on the LAN. Other services such as SSH/Tailscale still need separate firewall and exposure review.

Read the exact active site, including possible symlinks and overrides:

```bash
sudo nginx -t
sudo nginx -T 2>&1 | grep -n -A20 -B5 'cssu-kiosk\|127.0.0.1:8080'
systemctl is-enabled nginx
systemctl is-active nginx
curl -I http://127.0.0.1:8080/
```

**Do not replace a working Nginx file with a guessed server block.** First export the installed configuration and check any other `conf.d` or `sites-enabled` entries.

### 9.2 Production startup

Later operator evidence confirmed `cssu-kiosk.service` enabled and running with Cage + Chromium and a localhost signage URL. It was deployed **after** the early debugging record, which still described manual launch.

Inspect startup failures:

```bash
systemctl status cssu-kiosk.service --no-pager
journalctl -u cssu-kiosk.service -b -n 100 --no-pager
systemctl cat cssu-kiosk.service
```

The exact production unit is the source of truth for console allocation, dependencies, restart behavior, and browser flags.

---

## 10. GitHub Release updater and client refresh

### 10.1 Release contract

The updater uses the public repository:

```text
REPO="chrislxn/cssu-kiosk"
BASE="/srv/cssu-kiosk"
ASSET="kiosk.zip"
```

Published releases are available at:

https://github.com/chrislxn/cssu-kiosk/releases

The archive is deployed to a version-specific directory and made active via the `current` symlink. The archive is expected to contain a working `index.html` and supporting assets. A subsequent updater revision dealt with archives containing a nested top-level directory rather than `index.html` at the archive root.

**Release format is an operational interface.** Maintain it consistently, and validate archives before publishing.

### 10.2 Updater behavior observed in testing

The previous deployment tests reported the following:

1. Fetch the latest GitHub Release metadata.
2. Locate the `kiosk.zip` asset.
3. Download the asset.
4. Verify SHA-256 against the release metadata when available.
5. Test and extract the ZIP, taking account of a possible nested archive root.
6. Stage the new release in `/srv/cssu-kiosk/releases/<tag>/`.
7. Write `version.txt` to the deployed content.
8. Atomically change `/srv/cssu-kiosk/current` to the new release directory.
9. Preserve older release directories for potential manual recovery.

The installed updater's exact shell implementation and all its failure branches have **not** been exported. The list above represents behavior described and partly demonstrated in operator output; do not infer a complete rollback or transaction guarantee without reviewing the script.

### 10.3 Actual deployment evidence

- Release `v0.2` downloaded, SHA-256 checked, ZIP extracted, and deployed; `current/version.txt` read back as `v0.2`.
- Release `v0.3` installed successfully through `cssu-update.service`; journal reported `CSSU Kiosk updated to v0.3`, and `current/version.txt` read back as `v0.3`.
- The public GitHub repo was observed with a published `v0.4` release (`kiosk.zip`, release title **Add Geotime**) on 2026-10-24. **There is no corresponding device-side evidence here that `v0.4` was installed.**

These facts are versioned historical observations, not a promise about the currently deployed release.

### 10.4 systemd updater unit and timer

The historical systemd components are:

```text
cssu-update.service
cssu-update.timer
/usr/local/bin/cssu-update
```

The updater service was reported running as `User=cssu`, `Group=cssu`. The timer was **confirmed enabled** and observed on a **30-minute** schedule. Later the operator asked whether it could run every **5 minutes**. The supplied record does not confirm that the 5-minute change was finally made.

Check before documenting a definitive interval:

```bash
sudo systemctl cat cssu-update.service cssu-update.timer
systemctl list-timers --all | grep cssu-update
systemctl show cssu-update.timer -p OnBootUSec -p OnUnitActiveUSec -p AccuracyUSec
```

Manually initiate one check:

```bash
sudo systemctl start cssu-update.service
journalctl -u cssu-update.service -n 100 --no-pager
```

Inspect the deployment:

```bash
cat /srv/cssu-kiosk/current/version.txt
readlink -f /srv/cssu-kiosk/current
ls -la /srv/cssu-kiosk/releases/
```

### 10.5 Browser-side refresh

The local webpage contains an `update.js` component (the release ZIP also included `sw.js` in the tested version). In the earlier successful configuration, `update.js` checked `version.txt` every **10 seconds**, used `cache: 'no-store'`, and refreshed the page after detecting a new deployed version.

There are **two independent intervals**:

- **Host timer:** When the system downloads/checks for new GitHub releases (observed 30 minutes; later 5-minute proposal unresolved).
- **Browser poll:** When the already running browser notices local `version.txt` changed (observed 10 seconds).

Reducing the browser poll does **not** make the host check GitHub more frequently, and vice versa. Verify the current frontend file if its polling behavior has since changed.

### 10.6 Recovery and rollback limits

Older releases were preserved, allowing a possible **manual rollback**. However, **automatic health-checked rollback was not verified**. Do not describe the project as having tested end-to-end automatic rollback until a release failure test demonstrates it.

A safe manual rollback plan is:

1. Read the currently active symlink and version.
2. Confirm the candidate previous release contains a valid `index.html` and assets.
3. Verify permissions/ownership of `/srv/cssu-kiosk`.
4. Use an atomic symlink replacement or the updater's supported rollback command, if one exists.
5. Reload Chromium and verify both page and local version.
6. Record the incident in the journal or issue tracker.

The exact write commands should be taken from the audited updater or approved maintenance script, rather than guessed in a README.

---

## 11. Scheduled services and timers

The project uses **systemd units and timers** for unattended operation. Some timer names were observed enabled; others were only designed.

| Unit(s) | Recorded purpose | Historical schedule | Evidence |
|---|---|---|---|
| `cssu-kiosk.service` | Start Cage and Chromium | At boot / service restarts | Later enabled/running |
| `cssu-update.service`, `cssu-update.timer` | Download and deploy Releases | Initially ~2 min after boot, every 30 min | Timer enabled; OTA v0.2 and v0.3 succeeded; 5-min proposal unresolved |
| `cssu-log-clean.service`, `cssu-log-clean.timer` | Rotate/vacuum journald | Daily **04:50** | Timer reported enabled |
| `cssu-reboot.service`, `cssu-reboot.timer` | Scheduled system reboot | Daily **05:00** America/Toronto | Timer reported enabled; final unit content needs export |
| `cssu-healthcheck.service`, `cssu-healthcheck.timer` | Detect stuck signage and recover | Proposed every **2 min** | Designed, installation unconfirmed |
| `orangepi-temp.service` | CPU/GPU temperatures to journal | Proposed every **30 sec** | Instructions supplied, running status unconfirmed |
| `nginx.service` | Local content server | At boot | Enabled |
| `fail2ban.service` | SSH brute-force protection | At boot | Loaded and queried |
| `logrotate.timer` | Standard log rotation | OS-managed | Listed as present |

### 11.1 Update timer

Do **not** copy a guessed timer schedule into the canonical production docs. Read:

```bash
systemctl cat cssu-update.timer
systemctl list-timers --all --no-pager
```

The question about increasing the frequency to 5 minutes did not, by itself, change the system. Even if a 5-minute interval is lightweight for this machine, confirm the actual installed timer.

### 11.2 Daily journal cleanup

The earlier cleanup command was:

```bash
/usr/bin/journalctl --rotate --vacuum-time=14d --vacuum-size=200M
```

The `cssu-log-clean.timer` was recorded enabled at **04:50** local time. Verify its time-zone behavior and schedule after daylight-saving changes:

```bash
systemctl cat cssu-log-clean.timer cssu-log-clean.service
systemctl list-timers --all --no-pager | grep cssu-log-clean
```

This command rotates the journal and removes qualifying archived journal files. It does not implement a separate compression/archive format.

### 11.3 Daily reboot

`cssu-reboot.timer` was recorded enabled for **05:00** local time. Earlier configuration notes specified `Persistent=false`, which should avoid making up for a missed calendar activation immediately on late boot, but **the exact installed unit needs verification**.

```bash
systemctl cat cssu-reboot.timer cssu-reboot.service
timedatectl
```

Scheduled reboot should not be the only response to an application failure. The display unit itself should have an appropriate restart policy, verified using `systemctl cat`.

### 11.4 Healthcheck design (not yet confirmed installed)

The discussed policy was:

- Run approximately every **2 minutes**.
- Require **3 consecutive failures** before considering a reboot.
- Enforce a **6-hour cooldown** after a healthcheck-triggered reboot.
- Persist state under:

```text
/var/lib/cssu-healthcheck/failures
/var/lib/cssu-healthcheck/last-reboot
```

A potential script path was:

```text
/usr/local/sbin/cssu-healthcheck
```

The material available **does not establish** the final conditions checked, its complete script, timer activation, or a successful self-recovery test. A status row describing it as *deployed* would be inaccurate without further evidence.

Inspect:

```bash
systemctl status cssu-healthcheck.timer cssu-healthcheck.service --no-pager
systemctl cat cssu-healthcheck.timer cssu-healthcheck.service
sudo test -f /usr/local/sbin/cssu-healthcheck && \
  sudo sed -n '1,260p' /usr/local/sbin/cssu-healthcheck
```

---

## 12. Temperature, cooling, and monitoring

### 12.1 Kernel thermal zones

The machine reported two thermal zones:

```text
cpu-thermal
gpu-thermal
```

Both zones exposed trip temperatures:

```text
trip_point_0_temp = 70000    (70 C)
trip_point_1_temp = 75000    (75 C)
trip_point_2_temp = 95000    (95 C)
```

The trip **types** and cooling-device mappings were not included in the submitted result. Do not assert that 70 C is definitely a throttling transition or 95 C is definitely an emergency power-off without reading the corresponding `trip_point_*_type` and bindings.

Inspection:

```bash
for z in /sys/class/thermal/thermal_zone*; do
  echo "=== $(cat "$z/type") ==="
  grep -H . "$z"/trip_point_*_type 2>/dev/null
  grep -H . "$z"/trip_point_*_temp 2>/dev/null
done
```

### 12.2 Observed cooling results

| Test condition | Approximate reading |
|---|---|
| Browser use, fan off | CPU around 70 C |
| Browser use, fan on | CPU around 63 C; GPU around 58 C |
| Low activity, fan on | CPU around 55 C |

These observations were made under different workloads, not under a controlled benchmarking protocol. They demonstrate a useful fan benefit, not a precise measured thermal resistance.

Do not assume occasional scrolling stutter is necessarily thermal throttling. Panfrost works, but Chromium workload, video software decode, compositor overhead, and CPU use can also affect responsiveness.

Read current temperatures without installing anything:

```bash
watch -n 1 'for z in /sys/class/thermal/thermal_zone*; do
  name=$(cat "$z/type")
  temp=$(cat "$z/temp")
  printf "%s: %s.%s C\n" "$name" "$((temp / 1000))" "$(((temp % 1000) / 100))"
done'
```

Inspect current cooling states:

```bash
for c in /sys/class/thermal/cooling_device*; do
  echo "$(cat "$c/type"): $(cat "$c/cur_state")/$(cat "$c/max_state")"
done
```

### 12.3 Reference temperature logger (installation pending verification)

The operator requested a continuously running service that logs to journald. The following commands were supplied, but **no successful `systemctl status` output has yet been provided for this service**. Treat this as a **reference implementation** and first check whether it is already present.

`/usr/local/bin/orangepi-temp-monitor`:

```sh
#!/bin/sh

while true; do
    output=""

    for zone in /sys/class/thermal/thermal_zone*; do
        [ -r "$zone/type" ] && [ -r "$zone/temp" ] || continue

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
```

Install executable permission if creating this file:

```bash
sudo chmod 755 /usr/local/bin/orangepi-temp-monitor
```

Reference unit `/etc/systemd/system/orangepi-temp.service`:

```ini
[Unit]
Description=Orange Pi Temperature Monitor
Documentation=man:journalctl(1)

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

If the script and unit are genuinely installed and reviewed, enable:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now orangepi-temp.service
```

Then verify:

```bash
systemctl status orangepi-temp.service --no-pager
journalctl -u orangepi-temp.service -f -o short-iso
journalctl -u orangepi-temp.service --since '1 hour ago'
```

This monitors and records temperatures; it **does not automatically control the fan, throttle the SoC, or send remote alerts**.

---

## 13. Journald retention and diagnostic logs

### 13.1 Historical production logging configuration

Earlier system records describe:

```text
/etc/systemd/journald.conf.d/90-cssu.conf
Storage=persistent
SystemMaxUse=200M
SystemMaxFileSize=32M
RuntimeMaxUse=50M
MaxRetentionSec=14d   (historical intended retention)
```

A later temperature-monitoring answer suggested a **different**, generic drop-in containing `Storage=persistent` and `SystemMaxUse=100M`. That was merely proposed and **must not be mistaken for the installed production value**.

`SystemMaxUse` applies to the **entire journal**, not a dedicated temperature-log quota. Retention is bounded by age, space limits, and system availability; `14d` is not a guarantee that 14 days will always fit on disk.

Check the effective configuration and files:

```bash
systemd-analyze cat-config systemd/journald.conf
sudo ls -la /etc/systemd/journald.conf.d/
journalctl --disk-usage
journalctl --list-boots
```

If persistent journals are desired on a newly provisioned host, create `/var/log/journal` and an approved journald drop-in rather than modifying historical production values without review. If a new drop-in is added, check ordering and conflicts with `90-cssu.conf`.

### 13.2 Log viewing

```bash
journalctl -u cssu-kiosk.service -b -n 100 --no-pager
journalctl -u cssu-update.service -n 100 --no-pager
journalctl -u orangepi-temp.service --since today --no-pager
journalctl -u fail2ban.service -b -n 100 --no-pager
journalctl -p warning -b --no-pager
journalctl --list-boots
```

For follow mode:

```bash
journalctl -u cssu-kiosk.service -f
```

### 13.3 Storage costs

A 30-second thermal poll produces 2,880 log entries per day, plus other system events. Journal caps prevent indefinite unbounded growth, but a small storage cap may remove history sooner than expected. Confirm log retention on eMMC after a few days of actual operation.

---

## 14. Package sources and software updates

### 14.1 Debian vs device-specific repositories

A later `apt update` retrieved Debian repository metadata successfully but failed against a Huawei Cloud Docker mirror:

```text
https://repo.huaweicloud.com/docker-ce/linux/debian/
File has unexpected size (1731 != 1866)
Mirror sync in progress?
```

There was also a warning that the Docker repository key was stored in the deprecated `/etc/apt/trusted.gpg` keyring. The download-size error reflects a mismatch between repository metadata and downloaded index content. **Do not disable APT integrity checks to bypass this error.**

The offending file was identified as:

```text
/etc/apt/sources.list.d/docker.list
```

The recommended repair was to disable the stale Huawei Cloud Docker source and configure Docker's official Debian repository with a scoped key in `/etc/apt/keyrings/docker.asc` and a `.sources` file.

**This troubleshooting was recorded in a Bookworm APT session.** Before reproducing anything today, read `/etc/os-release` and confirm whether Docker is installed or required by the current kiosk. Nothing in the demonstrated Nginx/Cage/Chromium architecture requires Docker CE.

### 14.2 Live source inspection

```bash
cat /etc/os-release
apt-cache policy
sudo grep -RniE 'huaweicloud|docker-ce|download.docker.com|^deb |^URIs:' \
  /etc/apt/sources.list /etc/apt/sources.list.d/ 2>/dev/null
```

Do not remove Orange Pi/Armbian-specific repository definitions casually; they may supply board-specific packages and kernel components. Treat distribution updates separately from the previously frozen boot stack.

### 14.3 Upgrade procedure

1. Verify root filesystem, distro codename, kernel, and boot source.
2. Confirm the current Release deployment and a working recovery image.
3. Review proposed APT package changes before approving them.
4. Avoid unconstrained kernel/bootloader upgrades on a known fragile board configuration.
5. Restart or reboot only within an agreed maintenance window.
6. Validate startup, network, local server, GPU/display, and timers after changes.

---

## 15. Routine operating procedures

### 15.1 Quick health inspection

```bash
uptime
free -h
df -h
systemctl --failed
systemctl list-timers --all --no-pager
```

### 15.2 Check core services

```bash
systemctl is-active nginx
systemctl is-active cssu-kiosk.service
systemctl is-enabled cssu-update.timer
systemctl status fail2ban --no-pager
```

Note: a oneshot update **service** can normally be inactive between runs. The active/enabled state of its **timer** and recent success/failure log are what matter.

### 15.3 Check live deployed content

```bash
readlink -f /srv/cssu-kiosk/current
cat /srv/cssu-kiosk/current/version.txt
curl -sS -I http://127.0.0.1:8080/
```

### 15.4 Review the last update

```bash
journalctl -u cssu-update.service -n 80 --no-pager
```

### 15.5 Check temperature and disk usage

```bash
for z in /sys/class/thermal/thermal_zone*; do
  printf '%s: ' "$(cat "$z/type")"
  awk '{printf "%.1f C\n", $1/1000}' "$z/temp"
done
journalctl --disk-usage
df -h /
```

### 15.6 Suggested periodic operations checklist

- Check that the physical display is showing the newest *intended* release.
- Confirm that the current deployment loads without internet access.
- Review `systemctl --failed` and recent journal warnings.
- Check temperature with the fan operating normally.
- Check that the 04:50 cleanup and 05:00 reboot timers behaved as expected.
- Review the latest available OS security updates separately from kernel changes.
- Inspect the case's power-button clearance and fan condition.
- Preserve a restorable copy of the working boot configuration and service definitions.

---

## 16. Failure recovery and troubleshooting

| Symptom | Most relevant checks | Interpretation |
|---|---|---|
| Boot stalls on splash logo | DTB `fdtfile`, image version, boot console, storage source | Historical V2.1 DTB mismatch was a successful repair target |
| Blank screen after OS boot | `cssu-kiosk.service` journal, Cage, TTY1, HDMI mode | GUI startup issue may be distinct from kernel boot |
| Cage cannot open TTY over SSH | User's logind session, PAM, TTY ownership | Test locally or inspect production systemd unit |
| Chromium refuses root launch | `User=` in display service | Use unprivileged `cssu`; do not disable sandbox as a routine workaround |
| Browser scrolls slowly | `chrome://gpu`, `/dev/dri` access, CPU, thermal state, video decode | GPU render acceleration can work while video decoding remains software-based |
| New release not displayed | Timer, update service logs, symlink, `version.txt`, `update.js` | Separate host updater from browser poll |
| Update fails while offline | DNS, TLS, API availability, disk space | Existing local deployment should remain serving content; verify in failure test |
| `apt update` fails on Docker mirror | `.list`/`.sources`, suite, release metadata, signing key | Do not turn off package-index signature/size checks |
| SSH warns host identification changed | Reimage history and **verified** new fingerprint | Do not blindly accept a changed identity |
| CPU near 70 C | Fan, enclosure, load, cooling state, trip types | Not automatically proof of thermal throttling |
| Journal missing after reboot | `/var/log/journal`, effective journald config | Inspect retention and service status |
| Power button triggered by case | Mechanical clearance | Software ignore policy is not a hardware fix |

### 16.1 Display will not start

```bash
systemctl status cssu-kiosk.service --no-pager
journalctl -u cssu-kiosk.service -b -n 160 --no-pager
systemctl status nginx --no-pager
curl -I http://127.0.0.1:8080/
```

Check `getty@tty1.service` conflicts, PAM configuration, and the display session environment before changing any of them.

### 16.2 Updater reports success but browser remains old

```bash
cat /srv/cssu-kiosk/current/version.txt
readlink -f /srv/cssu-kiosk/current
curl -sS http://127.0.0.1:8080/version.txt
journalctl -u cssu-update.service -n 100 --no-pager
```

If the local version is new but the screen has not refreshed, examine the browser `update.js` poll and service worker cache behavior. If the local version remains old, investigate the host updater instead.

### 16.3 System boots but kernel/GPU driver changes

```bash
uname -a
lsmod | grep panfrost
readlink -f /sys/class/drm/renderD128/device/driver
journalctl -k -b | grep -Ei 'panfrost|mali|drm|rk3566' | tail -n 80
```

Compare against a known-good recorded boot. Do not conclude the board is defective from one failed new image; the prior V2.1 DTB fix shows why configuration details matter.

---

## 17. Read-only inventory and configuration export

The **highest-priority remaining documentation work** is to export the live files verbatim. A polished README cannot substitute for exact scripts and units when the device must be rebuilt.

### 17.1 Safe overview (no changes)

Run on the device:

```bash
sudo bash <<'EOF_AUDIT'
echo '=== SYSTEM ==='
hostnamectl
cat /etc/os-release
uname -a
timedatectl

echo '=== STORAGE ==='
lsblk -o NAME,SIZE,FSTYPE,MOUNTPOINTS,MODEL
findmnt -no SOURCE /

echo '=== TIMERS ==='
systemctl list-timers --all --no-pager

echo '=== SERVICE STATUS ==='
for u in \
  cssu-kiosk.service cssu-update.service cssu-update.timer \
  cssu-log-clean.service cssu-log-clean.timer \
  cssu-reboot.service cssu-reboot.timer \
  cssu-healthcheck.service cssu-healthcheck.timer \
  orangepi-temp.service nginx.service fail2ban.service; do
  echo "--- $u ---"
  systemctl show "$u" -p LoadState -p ActiveState \
    -p UnitFileState -p FragmentPath --no-pager
done

echo '=== FILE PRESENCE ==='
for p in \
  /usr/local/bin/cssu-update \
  /usr/local/sbin/cssu-healthcheck \
  /usr/local/bin/orangepi-temp-monitor \
  /etc/systemd/journald.conf.d/90-cssu.conf \
  /etc/nginx/sites-available/cssu-kiosk \
  /etc/pam.d/cssu-kiosk \
  /home/cssu/kiosk.sh; do
  if [ -f "$p" ]; then
    stat -c '%n | %s bytes | %y' "$p"
  else
    echo "MISSING: $p"
  fi
done

echo '=== CURRENT DEPLOYMENT ==='
readlink -f /srv/cssu-kiosk/current 2>/dev/null || true
cat /srv/cssu-kiosk/current/version.txt 2>/dev/null || true

echo '=== JOURNAL ==='
journalctl --disk-usage
journalctl --list-boots

echo '=== FAILED UNITS ==='
systemctl --failed --no-pager
EOF_AUDIT
```

This prints metadata, state, version, and some network-independent system facts. It does not print passwords or SSH private keys. Even so, review output for hostnames, local addresses, and paths before public release.

### 17.2 Export actual unit bodies (review before sharing)

```bash
sudo systemctl cat cssu-kiosk.service
sudo systemctl cat cssu-update.service
sudo systemctl cat cssu-update.timer
sudo systemctl cat cssu-log-clean.service
sudo systemctl cat cssu-log-clean.timer
sudo systemctl cat cssu-reboot.service
sudo systemctl cat cssu-reboot.timer
sudo systemctl cat cssu-healthcheck.service
sudo systemctl cat cssu-healthcheck.timer
sudo systemctl cat orangepi-temp.service
```

A missing unit is useful evidence, not a reason to fabricate one.

Also review, locally:

```bash
sudo sed -n '1,300p' /usr/local/bin/cssu-update
sudo sed -n '1,300p' /usr/local/sbin/cssu-healthcheck
sudo sed -n '1,300p' /usr/local/bin/orangepi-temp-monitor
sudo cat /etc/pam.d/cssu-kiosk
sudo cat /etc/nginx/sites-available/cssu-kiosk
systemd-analyze cat-config systemd/journald.conf
```

**These commands can print sensitive information** if scripts or configs contain credentials. Do not paste raw output into a public issue or README without redaction.

### 17.3 Audit OS package history and alternative schedulers

```bash
sudo ls -l /var/log/apt/history.log*
sudo grep -RniE 'cssu|kiosk|signage' /etc/cron* 2>/dev/null || true
sudo systemctl list-unit-files --state=enabled --no-pager
```

Shell command history can be helpful for forensics but is **not a complete audit log**: commands may never have been written, may be missing timestamps, or may contain secrets. Inspect it privately rather than publishing it.

### 17.4 Proposed version-controlled archive after audit

```text
README.md
LICENSE
docs/
  SYSTEM.md                 # this document
  FRONTEND_DESIGN.md        # maintained by a separate frontend agent
  INCIDENTS.md              # optional, sanitized
  INSTALLATION_CHECKLIST.md # optional, after live audit
deploy/
  systemd/                  # exported and reviewed units
  nginx/                    # sanitized vhost config
  pam/                      # sanitized session config
  fail2ban/                 # reviewed SSH jail
  journald/                 # reviewed journal retention config
scripts/
  cssu-update               # exported and reviewed updater
  cssu-healthcheck          # only after verified
  orangepi-temp-monitor     # only after verified
```

**Directory listing above is a recommendation, not a declaration that those files already exist in GitHub.** The release `kiosk.zip` currently provides deployment assets; preserve and version the maintained web application source as well, following the separate frontend team's conventions.

---

## 18. Known gaps and acceptance tests

Use this checklist to decide when the system documentation can honestly be labeled *reproducible*.

### 18.1 Configuration still to capture

- [ ] Confirm live OS release (`bookworm` vs `trixie`), running kernel, hostname, boot source, and storage map.
- [ ] Confirm eMMC-only boot with the microSD removed, when safe to test.
- [ ] Export `/boot/armbianEnv.txt` and record any remaining kernel/bootloader holds.
- [ ] Export the **actual** `cssu-kiosk.service` and `/etc/pam.d/cssu-kiosk`.
- [ ] Export and sanitize the exact Nginx site configuration.
- [ ] Export `/usr/local/bin/cssu-update`, `cssu-update.service`, and the **actual** timer schedule.
- [ ] Confirm whether the 5-minute OTA schedule was implemented or remained a proposal.
- [ ] Confirm current deployed version: `v0.3` was last verified in the supplied device journal; `v0.4` was later visible in GitHub Releases.
- [ ] Export `cssu-log-clean.*` and `cssu-reboot.*` units, including calendar timezone semantics.
- [ ] Confirm whether `cssu-healthcheck.*` is actually installed and what it checks.
- [ ] Confirm whether `orangepi-temp.service` is installed and logging.
- [ ] Reconcile `90-cssu.conf` (historical 200 MB) with any later 100 MB journald drop-in.
- [ ] Confirm power-button mechanical clearance or whether a logind override was actually created.
- [ ] Record current firewall and Tailscale authorization/access controls.
- [ ] Establish an appropriately sanitized service/source backup in GitHub.

### 18.2 Operational tests still to complete

- [ ] Boot and display signage unattended after a cold power cycle.
- [ ] Restart Chromium/Cage after an induced browser crash without operator input.
- [ ] Continue showing the previous release during loss of DNS, internet, and GitHub access.
- [ ] Handle an absent asset, corrupted ZIP, and checksum mismatch without replacing the working deployment.
- [ ] Verify archive nesting handling on a test release.
- [ ] Verify browser refresh after a successful release deployment.
- [ ] Demonstrate a deliberate manual rollback from a newer release to a known-good one.
- [ ] Confirm whether any automated rollback exists; do not assume it.
- [ ] Inspect temperature and active cooling states during sustained rendering load.
- [ ] Confirm temperature logs survive a reboot and stay within journal retention limits.
- [ ] Confirm maintenance timers at 04:50 and 05:00, with daylight-saving and missed-boot behavior.
- [ ] Verify Fail2Ban's actual packet-filter action without locking out maintainers.
- [ ] Check the display resolution and orientation persist after reboot.
- [ ] Confirm safe power behavior with enclosure flex and button contact.

---

## 19. Provenance and change history

### 19.1 Evidence used to assemble this record

This document was based on:

1. The imported 974-line historical debugging summary (Orange Pi 3B V2.1, Armbian/DTB, graphics, acceleration, VPU, Tailscale, Fail2Ban, and mechanical power-button issue).
2. Later CSSU Kiosk deployment conversations, including systemd unit names, Nginx localhost serving, GitHub Release updater, `v0.2`/`v0.3` deployment logs, journald and scheduled maintenance.
3. Directly supplied thermal-zone output, active/idle temperature readings, and the proposed temperature service.
4. A read of the public GitHub repository on 2026-10-24: it contained a short README and MIT license, and a `v0.4` release containing `kiosk.zip`.

Sources 1-3 are operator-provided development records. The documentation author did **not** log into the live device to retrieve current file contents. All open evidence gaps are marked.

### 19.2 Condensed chronology

| Stage | Outcome |
|---|---|
| Original vendor OS | Older Rockchip 5.10 kernel booted |
| Newer Armbian image attempts | Several failed or stalled |
| V2.1 device-tree selection | Armbian 26.11 / Linux 6.18.57 booted successfully |
| Graphics bring-up | Cage + Chromium at 1080p worked |
| GPU verification | Mali-G52 + Panfrost confirmed with EGL and Chromium GPU-process checks |
| Video analysis | GStreamer RKVDEC decode worked; tested Chromium H.264 used FFmpeg software decode |
| Remote admin / hardening | Tailscale active; Fail2Ban `sshd` jail loaded |
| Production deployment | `cssu-kiosk.service` and Nginx later enabled |
| OTA | Releases `v0.2` and `v0.3` installed successfully |
| Maintenance timers | Update, log cleanup, and daily reboot timers enabled |
| Thermal assessment | Fan improved temperatures; 70/75/95 C trip points observed |
| Temperature journaling | Script/service supplied as instructions; activation not yet demonstrated |
| Public repo as observed | `v0.4` release available, not confirmed deployed |

### 19.3 Documentation maintenance policy

When changing a system component, update this document with:

- **Date** and **device OS/kernel** at time of change.
- Exact file changed and, where safe, the sanitized diff.
- How the change was applied.
- A verification command and its successful output.
- A safe rollback plan, if applicable.
- Whether the change is present on the production device or exists only in version control.

The aim is for the next CSSU maintainer to reproduce the same behavior from a clean system, without relying on private chat history.

---

**Document status:** Initial consolidated system record. Substantive historical details are captured; exact production scripts and final timer values still require a live read-only configuration audit before this can be called a fully reproducible installation guide.
