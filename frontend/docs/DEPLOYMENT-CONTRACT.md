# CSSU Kiosk — Frontend Technical Specification

**Project:** CSSU Digital Signage  
**Platform:** Orange Pi 3B / Armbian / Chromium Kiosk  
**Document Version:** 1.1<br>
**Revised:** 31 October 2026<br>
**Deployment:** GitHub Releases → Local Nginx → Chromium  
**Status:** Engineering requirements; target-device release acceptance pending

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
| Device Release Check | Every 30 minutes (device-managed; confirm installed timer) |
| Frontend Version Polling | Every 10 seconds |
| World-Time Broadcast | Every 10 Toronto minutes; 20 seconds per broadcast |
| Scheduled System Reboot | 05:00 America/Toronto |

The frontend must not depend on GitHub, cloud APIs, external CDNs, or any other external service to render its essential content.

## 2. Frontend Architecture

The application should remain a lightweight static web application.

Current runtime structure (all listed scripts/styles and every referenced local asset are required; the worker remains disabled by default):

```text
kiosk.zip
├── index.html
├── app.js
├── content.js
├── display-shell.js
├── time-signal-config.js
├── time-signal.js
├── update.js
├── styles.css
├── time-signal.css
├── assets/
│   ├── cssu-logo.webp
│   ├── cssu-icon.webp
│   ├── code.svg
│   ├── play.svg
│   ├── build.svg
│   ├── microphone.svg
│   ├── world-food.svg
│   ├── world-clock.svg
│   └── products/        # All local product SVGs, including the fallback
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

### Approved poster and clock behavior

Use [DESIGN-SPEC.md](../DESIGN-SPEC.md) for visual requirements and [README.md](../README.md) for the current content contract. The November posters use their approved pale-blue/navy microphone theme and sky-blue/yellow-green world-food theme within the existing 1920 × 1080 composition. Real events carry no sample-event label; the independent demo-price disclaimer remains.

The integrated Toronto clock remains visible during normal playback. The independent world-time signal takes over at Toronto `:00`, `:10`, `:20`, `:30`, `:40`, and `:50`, lasting 20 seconds: Toronto for 5 seconds, the first four-city group for 7.2 seconds, the second four-city group for 7.2 seconds, and a 0.6-second exit. It is silent and restores the current eligible poster and price ribbon. The 14-second poster interval, 10-minute time-signal cadence, 10-second browser version poll, and device release-check timer are separate settings.

Event validity is start-inclusive and end-exclusive. Expired posters and their corresponding notices are removed by the one-second eligibility refresh without another deployment. After all events expire, a neutral community standby poster replaces them, while ordinary notices, the price ribbon, and both clock modes continue running. This must work entirely from installed local files.

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
- [ ] No `version.txt` is bundled; the updater generates it from the activated release tag.
- [ ] The archive contains no wrapping `frontend/` or `cssu-signage/` directory, `.git`, `__MACOSX`, or `.DS_Store` entries.
- [ ] The archive passes a ZIP integrity check and the extracted runtime files match the reviewed source revision.
- [ ] All new activity illustrations and all world-clock/configuration scripts and styles are present, with `serviceWorker: false` and `persistContent: false` retained.
- [ ] A companion `kiosk.zip.sha256`, when supplied, contains the SHA-256 of the exact uploaded `kiosk.zip` and the filename `kiosk.zip`; record the archive digest and release source revision. The installed updater's checksum-consumption mechanism must be confirmed on the device rather than assumed from the companion filename.

### Poster appearance and content

- [ ] At 1920 × 1080, both event titles remain two lines at the approved 174 px size, with no clipping, overlap with the main illustration, or scrollbars.
- [ ] Fumbles & Failures uses the pale-blue/navy palette and local microphone/cloud/repair illustration; Bytes Around the World uses the sky-blue/yellow-green palette and local world-food/flight illustration.
- [ ] The original CSSU logo, shared composition, 112 px price ribbon, approved CAD prices, and demo-price labels are preserved.
- [ ] Switching in both directions between light and dark posters updates the logo presentation, integrated clock, notices, and progress text with adequate contrast; standby restores the dark-teal palette.
- [ ] Real events (`isSample: false`) omit visible and accessible sample-event labels; omitted/true retains both labels for sample content. Invalid updates leave the last valid content running.
- [ ] All illustrations load locally, reduced-motion preferences are respected, and the display requires no viewer input.

### World-time scheduling and restoration

- [ ] Toronto `:00`, `:10`, `:20`, `:30`, `:40`, and `:50` automatically start the signal; verify a boundary immediately before/at its due time, then the next ten-minute boundary.
- [ ] Exactly one one-shot scheduler timer is armed while idle, with no repeating idle scheduler interval, grace window, or artificial trigger delay. Seconds update only during an active signal.
- [ ] A registered callback delivered late executes once, and the next deadline remains the next real ten-minute boundary rather than ten minutes after that callback.
- [ ] Opening or returning after a boundary waits for a future boundary; visibility changes and back/forward-cache restoration re-arm scheduling without stale playback.
- [ ] A scheduled boundary preempts an overlapping operator preview; previews do not consume scheduled slots. Only completed scheduled broadcasts are persisted for reload deduplication.
- [ ] The 20-second sequence is Toronto at 0–5 s; Los Angeles/New York/Shanghai/London at 5–12.2 s; Tokyo/Seoul/New Delhi/Sydney at 12.2–19.4 s; exit at 19.4–20 s. Each four-city page is four simultaneous portrait columns.
- [ ] All nine cities show correct local dates, seconds, IANA-derived zone/offset data, New Delhi's half-hour offset, and distinct repeated-hour DST slots.
- [ ] Poster/notice advancement and the price ribbon pause for the signal. At exit, the eligible poster resumes with a fresh 14-second interval, correct palette and restored accessibility attributes; the price ribbon resumes.
- [ ] Event updates, rejected updates, and event timezone edits do not reset an active signal. Either module can run without the other module's API.
- [ ] A simulated 24-hour run completes 144 scheduled signals with no accumulation of idle timers. Separately verify real device timing and long-duration operation; simulation is not hardware endurance evidence.

### Expiry and standby

Use the current owner-approved 2026 dates and Toronto EST offsets; the source posters omit a year, and the chosen year is documented in README.md.

| Test boundary | Required result |
| --- | --- |
| Immediately before `2026-11-03T16:00:00-05:00` | Both posters are eligible; the Fumbles notice remains eligible |
| At/after `2026-11-03T16:00:00-05:00` | Fumbles and its notice are ineligible; the next eligibility refresh leaves Bytes as the only event |
| Immediately before `2026-11-06T17:00:00-05:00` | Bytes and its notice remain eligible |
| At/after `2026-11-06T17:00:00-05:00` | Bytes and its notice are ineligible; the next refresh selects standby with no expired-event notice |

- [ ] Check the pure eligibility result 1 ms before, exactly at, and 1 ms after each end timestamp, then check automatic rendered removal on the next one-second refresh.
- [ ] Standby reads “Your space.” / “Your people.” and “No events are scheduled right now.”, uses the original dark-teal palette, and carries no sample-event label. Fictional sample events do not reappear.
- [ ] After expiry, ordinary community/demo-menu notices, CAD prices, integrated Toronto time, and ten-minute broadcasts remain operational; no reload, release, or manual deletion is required.
- [ ] Expiry during a broadcast leaves that broadcast intact and reveals the next eligible poster or standby on exit. Also verify a cold start after the final expiry.

### Verification evidence and sign-off

These checklists are requirements for each release, not a record that every item has already passed. For sign-off record the tested commit, release tag, ZIP SHA-256, environment, date, results, and any open failures. Run `node --test tests/*.test.mjs` from `frontend/` for the committed scheduler/module regressions; syntax checks alone do not establish behavior.

Local verification recorded on October 31, 2026 for runtime source `22d49100d0b390c10585a63fe1d5f598b6c5a4b9`:

| Scope | Evidence recorded | Remaining acceptance |
| --- | --- | --- |
| Scheduler and module boundaries | Both committed Node suites passed, including 144-signal simulation, late callbacks without drift, deduplication, preview preemption, restoration, timezones, and module independence | Actual Orange Pi timing/endurance |
| Browser | Headless Chrome at 1920 × 1080 passed both poster layouts/assets, theme restoration, sample-label handling, expiry boundaries and automatic standby, reduced motion, complete 20-second playback, and automatic 12:20/12:30 triggers under a controlled clock; no failed resources, remote requests, or browser errors | Installed Chromium/Cage/HDMI visual and performance checks; explicit expiry-during-broadcast and cold-start-after-expiry cases |
| Package | ZIP integrity, root structure, local resource references, source-byte equality, syntax, cache defaults, and SHA-256 were checked; packaged clock/config matched the owner's previous version | Published asset digest, installed updater, device-generated version and successful activation |
| Updates and recovery | Update code/defaults were preserved; this revision did not perform device deployment or service-worker migration testing | Real Nginx refresh, unchanged/changed/empty/failed/timed-out responses, previously registered worker migration, reboot/power-loss recovery, and sustained operation |

Keep target-device acceptance pending until that evidence exists. Documentation approval and a passing local simulation do not certify production readiness.

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
