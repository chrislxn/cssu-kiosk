# CSSU Kiosk — Frontend Technical Specification

**Project:** CSSU Digital Signage  
**Platform:** Orange Pi 3B / Armbian / Chromium Kiosk  
**Document Version:** 1.0  
**Deployment:** GitHub Releases → Local Nginx → Chromium  
**Status:** Engineering Requirements

---

## 1. System Overview

CSSU Kiosk is an unattended, always-on digital signage application designed to operate continuously on an Orange Pi 3B.

The frontend is served from a local Nginx instance and displayed through Chromium in Wayland Kiosk mode, managed by Cage.

The system must remain functional without an active internet connection.

### Runtime Environment

| Component | Configuration |
|---|---|
| Operating System | Armbian (Debian 13) |
| Device | Orange Pi 3B |
| Web Server | Nginx |
| Local URL | `http://127.0.0.1:8080/` |
| Browser | Chromium (Wayland) |
| Compositor | Cage |
| Deployment Source | GitHub Releases |
| Repository | `chrislxn/cssu-kiosk` |
| Deployment Directory | `/srv/cssu-kiosk/current/` |
| Update Frequency | Every 30 minutes |
| Frontend Version Polling | Every 10 seconds |
| Scheduled System Reboot | 05:00 America/Toronto |

The frontend must not depend on GitHub, cloud APIs, external CDNs, or any other external service to render its essential content.

## 2. Frontend Architecture

The application should remain a lightweight static web application.

Recommended structure:

```text
kiosk.zip
├── index.html
├── app.js
├── content.js
├── update.js
├── styles.css
├── assets/
│   ├── logo.webp
│   ├── icons/
│   └── images/
└── sw.js               # Optional; disabled by default
```

### Requirements

- All assets must be bundled locally.
- Avoid unnecessary runtime dependencies and large frameworks.
- Use relative URLs for internal assets.
- All resources must work when served through the local Nginx server.
- Do not hardcode GitHub URLs as runtime asset dependencies.
- Do not require a build process on the Orange Pi itself.
- The ZIP archive should contain `index.html` at its root.
- The application must support unattended startup and operation.

The frontend must not modify system files, restart system services, or implement its own Linux deployment logic.

## 3. Deployment and Version Management

Frontend deployments are distributed through GitHub Releases.

Each production Release must contain an asset named:

`kiosk.zip`

Example Release tags:

```text
v0.2
v0.3
v1.0.0
```

### Deployment Procedure

The Orange Pi update service is responsible for:

1. Checking the GitHub Releases API for the latest stable Release.
2. Comparing the remote version with the currently installed version.
3. Downloading `kiosk.zip` if a new version is available.
4. Verifying the downloaded archive and its SHA-256 checksum.
5. Extracting the archive into a separate release directory.
6. Validating the required application files.
7. Generating `version.txt` automatically.
8. Switching the active deployment through the `current` symbolic link.

**The frontend developer must not manually include or maintain `version.txt` inside `kiosk.zip`.**

The device-side deployment system generates this file from the GitHub Release tag.

Example:

```text
GET /version.txt

HTTP/1.1 200 OK

v0.3
```

Nginx serves the active deployment through:

```text
/srv/cssu-kiosk/current/
```

Nginx does not need to reload when a new static frontend version is deployed.

## 4. Automatic Browser Refresh

**Automatic refresh is a mandatory frontend feature.**

The frontend must detect deployment changes without user interaction, browser restarts, or system restarts.

The existing `update.js` implements this functionality and should remain part of every Release.

### Update Detection

The browser must:

1. Poll the local `version.txt` endpoint every 10 seconds.
2. Disable HTTP caching for version requests.
3. Establish the current version on the first successful response.
4. Compare subsequent responses against the stored version.
5. Reload the page when the version changes.

Required configuration:

```javascript
const VERSION_CHECK_INTERVAL = 10000;
const VERSION_REQUEST_TIMEOUT = 8000;
```

Version requests must use:

```javascript
fetch('./version.txt', {
  cache: 'no-store',
  signal: controller.signal
});
```

The polling mechanism must prevent overlapping requests.

The version check must never contact GitHub directly. GitHub polling is the responsibility of the device-side updater.

### Reload Behavior

When a version change is detected:

```javascript
location.reload();
```

The application must perform a full page reload rather than attempting partial updates of individual JavaScript, CSS, or image assets.

The reload must occur only after the new deployment has been activated by the system updater.

### Script Inclusion

The following script must remain included in `index.html`:

```html
<script src="update.js" defer></script>
```

Do not remove or disable it.

Do not introduce another independent version-checking implementation without an explicit architectural review.

### Expected Behavior

| Condition | Frontend Behavior |
|---|---|
| Version unchanged | Continue displaying |
| New version detected | Reload page |
| Local server temporarily unavailable | Keep current page running |
| Version request times out | Retry on next interval |
| Invalid or empty version response | Ignore response |
| GitHub unavailable | No frontend impact |
| System reboot | Load current local deployment normally |

A temporary network or server failure must never trigger an infinite reload loop.

## 5. Caching and Service Workers

Predictable deployment behavior is more important than aggressive caching.

### HTTP Caching

The current Nginx deployment uses:

```http
Cache-Control: no-store
```

The frontend must remain compatible with this policy.

HTML, JavaScript, CSS, and asset changes must become visible after a deployment-triggered page reload.

### Service Worker Policy

The project includes an optional `sw.js`.

However, Service Worker caching is **disabled by default** in `content.js`:

```javascript
serviceWorker: false
```

This default must be preserved unless Service Worker caching is explicitly required and tested.

Do not enable a cache-first Service Worker without ensuring that deployments cannot become trapped on old HTML or JavaScript.

If Service Worker caching is enabled in the future:

- `version.txt` must always bypass the Service Worker cache.
- HTTP requests with `cache: 'no-store'` must bypass cached responses.
- Application caches must be versioned.
- Old application caches must be removed during upgrades.
- A new deployment must eventually replace all obsolete resources.
- Previously registered Service Workers must be considered during migration and testing.

The preferred production configuration is to operate without Service Worker caching.

## 6. Offline-First Operation

CSSU Kiosk must continue functioning when internet connectivity is unavailable.

### Mandatory Requirements

- All essential text, images, icons, stylesheets, and scripts must be available locally.
- Essential rendering must not depend on third-party APIs.
- External font providers must not be required.
- The UI must not display network errors when GitHub becomes unreachable.
- The frontend must not redirect the browser to an external website.
- Local content must remain usable during GitHub outages.

Network availability is required for receiving updates, not for displaying already-installed content.

The local Nginx server remains the primary application origin.

The application must not use `file://` URLs in production.

## 7. Performance Requirements

The target device is a resource-constrained ARM single-board computer.

Frontend implementations must prioritize stability and predictable resource consumption over unnecessary visual effects.

### JavaScript

- Avoid continuous polling loops and unnecessary background work.
- Avoid repeatedly rebuilding the entire DOM.
- Prefer event-driven updates over high-frequency timers.
- Clean up unused event listeners and timers.
- Avoid unbounded arrays, caches, and memory retention.
- Avoid excessive console logging during normal operation.

### Rendering

- Prefer CSS transforms and opacity for animations.
- Minimize expensive layout recalculations.
- Avoid excessive blur effects, large shadows, and unnecessary compositing.
- Use appropriately sized and compressed image assets.
- Avoid continuously animating content unless required.
- Keep animation frame rates and transitions reasonable.

### Assets

- Prefer WebP or AVIF for suitable raster images.
- Prefer SVG for simple icons and logos.
- Avoid excessively large images when rendered at small dimensions.
- Bundle fonts locally when custom fonts are required.
- Avoid automatically playing high-resolution video unless explicitly approved.

The frontend should remain stable during continuous operation and repeated browser reloads.

## 8. Display and User Interface Behavior

CSSU Kiosk is a dedicated digital signage application, not a general-purpose interactive browser application.

The frontend should:

- Start directly into the main display.
- Avoid unnecessary loading screens.
- Avoid authentication prompts.
- Avoid browser alerts, confirmation dialogs, and blocking popups.
- Handle content changes without requiring keyboard or mouse input.
- Adapt to the connected screen resolution.
- Display a usable fallback if optional content is unavailable.

The screen should never intentionally become blank because an external resource could not be loaded.

### Mouse Cursor

The frontend may use:

```css
* {
  cursor: none !important;
}
```

However, this only controls the pointer over HTML content. Cursor rendering at the Wayland compositor level is managed separately by Cage and the operating system.

The frontend must not attempt to modify Linux input devices or compositor configuration.

## 9. Failure Handling

Failure handling must be non-disruptive wherever possible.

### Frontend-Level Failures

| Failure | Required Behavior |
|---|---|
| Version check fails | Continue displaying current page |
| Invalid version response | Ignore and retry later |
| Optional image unavailable | Use a fallback |
| Optional content unavailable | Continue rendering essential content |
| Browser temporarily offline | Do not display a blocking error |
| Update detected | Reload once, then resume normal operation |

Do not trigger a system reboot from frontend JavaScript.

### System-Level Recovery

The device-side system manages:

- Nginx availability.
- Chromium and Cage process recovery.
- GitHub Release downloads.
- Deployment validation.
- Scheduled maintenance.
- Automatic system reboots.

The frontend must not duplicate these responsibilities.

A device-side health-check mechanism may restart services or reboot the device when persistent local failures are detected.

Temporary internet connectivity loss must not be treated as a device failure.

## 10. Security Requirements

- Never embed GitHub access tokens, passwords, private API keys, or credentials in frontend files.
- Treat externally supplied content as untrusted.
- Avoid unsafe HTML insertion.
- Do not execute downloaded JavaScript from third-party domains.
- Keep production functionality compatible with a localhost-only web server.
- Do not introduce unnecessary inbound network services.
- Do not expose internal system paths or diagnostic information in the user-facing display.

The frontend should function entirely through static assets served by Nginx.

## 11. Release Acceptance Tests

Before publishing a production Release, verify the following:

### Application

- [ ] `index.html` loads successfully.
- [ ] All images, icons, CSS, and JavaScript load locally.
- [ ] No essential external network requests are required.
- [ ] The page renders correctly in Chromium Kiosk mode.
- [ ] No blocking dialogs or prompts are displayed.
- [ ] The page remains usable without internet access.

### Automatic Updates

- [ ] `update.js` is included and running.
- [ ] The application can fetch `/version.txt`.
- [ ] Unchanged versions do not trigger reloads.
- [ ] A changed version triggers a full reload.
- [ ] The browser loads the newly deployed assets.
- [ ] Failed version checks do not cause reload loops.
- [ ] Obsolete Service Worker caches do not prevent updates.

### Deployment Package

- [ ] The Release includes `kiosk.zip`.
- [ ] `index.html` is present at the archive root.
- [ ] All referenced assets are included.
- [ ] Relative asset paths are valid.
- [ ] No secrets or development credentials are included.
- [ ] The application works without a development server.
- [ ] The package does not require a build step on the device.

## 12. Separation of Responsibilities

| Responsibility | Owner |
|---|---|
| Page layout and styling | Frontend |
| Content rendering | Frontend |
| Asset loading and fallback handling | Frontend |
| Local version polling | Frontend (`update.js`) |
| Browser page reload | Frontend |
| GitHub Release checking | Device updater |
| ZIP download and verification | Device updater |
| Deployment directory switching | Device updater |
| HTTP file serving | Nginx |
| Chromium process management | systemd / Cage |
| Log retention | systemd / logrotate |
| Scheduled reboot | systemd |
| System health recovery | Device health monitor |

Frontend code must not take over responsibilities assigned to the device operating environment.

---

## 13. Core Engineering Principles

All future frontend development must follow these principles:

**1. Local-first:** The installed application must run without internet access.

**2. Update-safe:** Every valid production Release must be deployable as a complete, independent package.

**3. Self-refreshing:** The browser must detect and display newly deployed versions automatically.

**4. Failure-tolerant:** Temporary connectivity and update failures must not interrupt existing content.

**5. Resource-conscious:** The application must be suitable for continuous operation on ARM hardware.

**6. Unattended:** Normal operation must not require a mouse, keyboard, SSH session, or manual browser interaction.

**7. Separation of concerns:** The frontend renders content; the operating system manages deployment, processes, and recovery.

### Final Requirement

**A frontend release is production-ready only when it can be installed, displayed, updated, refreshed, and operated without manual interaction or continuous internet access.**