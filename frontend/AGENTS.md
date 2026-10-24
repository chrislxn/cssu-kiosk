# Instructions for AI Contributors

If you are an AI assistant reading this project, use the following instructions when maintaining it. Follow higher-priority instructions and the owner's latest explicit request. These project defaults do not expand the scope of a task or grant permission to publish, deploy, message others, or change the device operating environment.

## Read first

1. Read [README.md](README.md) for the module map, data contracts, current limitations, and handoff workflow.
2. Read [DESIGN-SPEC.md](DESIGN-SPEC.md) before changing layout, styling, motion, or visible content structure.
3. Read [docs/DEPLOYMENT-CONTRACT.md](docs/DEPLOYMENT-CONTRACT.md) before changing update behavior or preparing a production package.
4. Inspect the actual files relevant to the request. Treat the current source as evidence of implementation, and distinguish it from intended production requirements.

The English documents are the current maintenance reference. `README-zh.md` is an earlier prototype guide; its local-file launcher and manual demo-version examples do not override the production deployment contract.

## Understand the product

CSSU Kiosk is a passive, unattended campus digital sign for an Orange Pi 3B with 4 GB RAM, Chromium, Cage, and a 1080p HDMI display. It is not a shopping/checkout application or an interactive dashboard.

Preserve the approved full-screen poster style: official CSSU logo, one large event message, one large illustration, integrated time and notice, and a single scrolling price ribbon with local product pictures. Do not restore a shop sidebar, a grid of small event cards, boxed clock panels, buttons, hover pauses, keyboard controls, or forms unless the owner explicitly requests a product change.

Visible copy is English. Keep fictitious event content clearly marked `SAMPLE EVENT`; preserve current demo-price labeling until the owner explicitly changes the content status. Never invent official events, dates, venues, prices, stock, opening hours, or API data. Keep content edits separate from visual redesign.

## Choose the correct module

| Request | Primary files |
| --- | --- |
| Event copy, prices, notices, event validity | `content.js` |
| Event-player rendering or schedule logic | `app.js` |
| Main display appearance | `styles.css` |
| World-clock cities, enabled flag, duration | `time-signal-config.js` |
| Clock scheduling or broadcast behavior | `time-signal.js` |
| Broadcast appearance | `time-signal.css` |
| Shared canvas fitting | `display-shell.js` |
| Local version checks | `update.js` |
| Shared markup and inclusion order | `index.html` |

Do not modify the time-signal files for an ordinary event, announcement, or price edit. Do not put clock configuration back into `content.js`.

The time-signal controller must not read `CSSU_CONTENT`, depend on `CSSUSignage`, or call event-player methods. The event player must not call the clock controller. Their coordination contract is limited to `cssu:time-signal-start` and `cssu:time-signal-end` document events. Preserve the `time-signal-active` CSS lifecycle class, pause/resume behavior, and restoration of underlay accessibility attributes.

Keep the shared `#screen` container and canvas fitting independent of event initialization. Both players must still work without the other's API. This does not provide protection from arbitrary global CSS changes, blocking JavaScript, or removal of shared resources; check both modes when editing shared files.

## Protect the approved clock behavior

- Trigger at Toronto local `:00` and `:30`; do not tie this to the main event timezone setting.
- Keep the default total duration at **14 seconds**.
- Page 1: Toronto alone, about 3.4 seconds including entry.
- Page 2: Los Angeles, New York, Shanghai, London in four simultaneous portrait columns, about 5 seconds.
- Page 3: Tokyo, Seoul, New Delhi, Sydney in four simultaneous portrait columns, about 5 seconds.
- Keep the final 0.6-second exit and restoration of the current poster with a fresh full event interval.
- Use IANA time zones through `Intl.DateTimeFormat`. Never calculate city times from fixed hour offsets. Include local dates, DST behavior, and India's half-hour offset in verification.
- Preserve near-boundary startup handling, same-slot reload deduplication, distinct DST repeated-hour slots, hidden-page handling, and timer cleanup.
- Do not add audio or viewer interaction without an explicit request.

## Preserve the runtime constraints

Use plain local HTML, CSS, JavaScript, WebP, and SVG. Do not introduce a framework, package-install requirement, device-side build step, CDN, remote font, telemetry, or external render-essential API without an explicit architectural request.

Use text nodes / `textContent` for editable copy. Keep the existing CSP; add local scripts as files rather than weakening `script-src` to permit arbitrary inline code. Keep product icon paths on an internal allowlist and retain the local fallback picture.

Prefer CSS transforms and opacity. Do not add permanent animation loops, repeated DOM rebuilds, large effects, WebGL, or high-resolution autoplay video. Keep `prefers-reduced-motion` support. All normal operations must work without input devices.

## Preserve updates and deployment ownership

- Keep `<script src="update.js" defer></script>` in `index.html`.
- Preserve one local version-check implementation: 10-second interval, 8-second request timeout, no overlapping requests, `cache: 'no-store'`, initial baseline, and full reload after a changed version.
- Temporary server/network failures must leave the current display running. Never poll GitHub from frontend code.
- Keep `serviceWorker: false` and `persistContent: false` by default. Enabling either needs an explicit use case and verification of deployment behavior.
- If modifying the optional worker, preserve `version.txt` / `no-store` bypasses and test migration from any previously registered worker. A cache-name change alone is not proof of a safe upgrade.
- Production uses local Nginx HTTP, not `file://`. Desktop file previews remain useful and skip HTTP version checks.
- A production asset is named `kiosk.zip` and has `index.html` at its root. Do not upload the existing folder-wrapped demo ZIP as that artifact.
- Exclude `version.txt` from production packaging. The device updater generates it from the release tag. The bundled file is only a local demo fixture; do not manually bump it as the production release mechanism.
- Do not modify system files, configure Nginx/Cage/systemd, create an updater, restart services, reboot the device, or publish a release as part of an unrelated frontend change.

## Work and verify proportionately

1. State the intended change briefly, inspect the relevant files, and make the smallest complete change within the owner's request.
2. For content-only work, preserve surrounding item data and approved prices unless the owner asks to change them. Update documentation that would otherwise contradict the edit.
3. For logic changes, exercise the actual failure or timing boundary. Do not present a syntax check as a behavioral test.
4. When changing event/clock coordination, verify that active broadcasts survive event updates and rejected event data, that the clock works without event globals, and that the event player works without the clock controller.
5. For layout changes, inspect the normal display and clock pages at 1920 × 1080, with long representative text, all local pictures loaded, and no clipping or scrollbars. Verify the complete return to the poster.
6. For update changes, check unchanged/changed/empty/failed/timed-out responses, no reload loops, and fresh resources after reload with the actual cache policy.
7. Before handing off an archive, inspect its contents, check required relative paths, and distinguish a desktop demo bundle from a production release package.
8. Report what changed, the checks actually performed, and any remaining hardware or deployment verification. Do not claim Orange Pi frame rate, sustained stability, or production readiness without target-device evidence.

Do not silently repair unrelated design, deployment, or documentation issues while performing a narrow task. Note a material discrepancy clearly and keep intended requirements distinct from current behavior. For example, `update.js` currently rejects empty/error responses but does not validate a release-tag grammar; stronger validation would be a separate change.

## Completion standard

Deliver working files and a truthful handoff. Preserve the established visual identity and unattended operation. Keep event maintenance independent from world-clock maintenance. Leave the next human or AI contributor with accurate documentation, intact local assets, and a clear understanding of what has and has not been verified.
