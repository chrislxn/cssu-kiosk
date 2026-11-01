# CSSU Kiosk — Frontend Design Specification

**Version:** 1.1<br>
**Baseline:** 24 October 2026; revised 31 October 2026<br>
**Scope:** the approved poster display and three-page time signal implemented in this project

This specification records the current visual and behavioral decisions. It guides incremental maintenance; it is not a request to redesign the screen. See [README.md](README.md) for architecture and operations, [AGENTS.md](AGENTS.md) for AI contributor instructions, and [the release acceptance checklist](docs/DEPLOYMENT-CONTRACT.md#11-release-acceptance-tests) for verification and remaining device checks.

## 1. Audience and viewing conditions

The display is viewed by people walking past a campus lounge or shop. They may see it for only a few seconds and from several metres away. Its first job is to communicate one clear event message, with recognisable CSSU identity and a readable price ribbon.

The application is a passive digital sign. There are no viewer actions. It must start directly into useful content and remain usable without an internet connection or an input device.

Page copy is English. Event samples must be explicitly identified as samples. Do not invent official dates, venues, availability, store opening hours, or organizational claims. Prices use owner-provided CAD values and the current demo-price disclaimer.

## 2. Composition and hierarchy

The normal display has one continuous background with these layers:

1. Official CSSU logo and university identification at the upper left; Toronto time integrated at the upper right.
2. One large two-line event headline, a short supporting sentence, and minimal event metadata.
3. A large local illustration occupying the right side.
4. A quiet announcement and decorative progress marks near the lower edge.
5. One full-width scrolling price ribbon at the bottom.

Preserve the full-screen poster composition. Do not reintroduce a dedicated shop sidebar, a dashboard grid of event cards, an isolated clock panel, multiple boxed notices, or an interactive carousel toolbar. Space should make the primary message easy to see; avoid both unused margins that shrink the poster and dense clusters of small secondary text.

### Canvas geometry

All dimensions below are CSS pixels on the **1920 × 1080 design canvas**, before scaling.

| Element | Current geometry |
| --- | --- |
| Stage | Fixed 1920 × 1080, centered and uniformly scaled |
| Scale | `min(viewportWidth / 1920, viewportHeight / 1080)` |
| Primary left/right safe margin | About 82–87 px |
| Main poster area | Full width, top to 112 px above the bottom |
| Brand/time baseline area | Header begins 45 px from the top |
| Main brand image | 284 × 79 px, intrinsic aspect ratio preserved |
| Main event text inset | 221 px from the top, 82 px from the left |
| Main illustration | 755 × 755 px, right 6 px, top 147 px |
| Announcement/progress area | Anchored 140 px above the bottom |
| Price ribbon | Full width, 112 px tall |
| Ribbon label | 280 px wide, 82 px left text inset |

Do not stretch the image to fill a different aspect ratio. A laptop or non-16:9 preview may show surrounding space. The production target is landscape 16:9. No scrollbar should appear at 1920 × 1080.

## 3. Identity and palette

Use the bundled official logo files, with provenance retained in [ASSET-SOURCES.md](ASSET-SOURCES.md). The horizontal black logo is displayed in white using CSS inversion against the dark background. Preserve its aspect ratio and avoid reconstructing it as ordinary text or inventing a replacement mark.

| Role | Value |
| --- | --- |
| Main teal background | `#15383e` |
| Ribbon text / dark ink | `#13333a` |
| Primary off-white text | `#f3f5ea` |
| Primary lime accent / ribbon | `#d4f48a` |
| Social-event background | `#41334d` |
| Social-event accent | `#ffd393` |
| Showcase background | `#223c58` |
| Showcase accent | `#b6def8` |
| Time-signal background | `#091e28` |
| Clock-date text | `#c4d8d8` |
| Clock structural line | Low-opacity `#b5d2cf` |

Keep contrast high for headlines, times, product names, and prices. Secondary labels can be subdued, but essential content must not depend on faint text or colour alone. Avoid heavy shadows, glass effects, blur, and ornamental cards.

### November event palettes

At the owner's request, the November posters echo their supplied promotional screenshots while preserving the canvas, two-line headline scale, local flat illustration treatment, masthead, and single lime price ribbon.

| Theme | Palette and motif |
| --- | --- |
| `fumbles` | Pale blue `#c9e8ec` → `#8bbfd5`, navy ink `#173f58`, blue accent `#1c6286`; microphone, cloud, peach repair motif, and a fine inset frame |
| `bytes` | Sky blue `#216eab` → `#114775`, off-white text, yellow-green accent `#e7f16f`; globe-shaped plate, food, and flight route |

Light posters use the unmodified black CSSU logo with navy masthead, clock, notice, and progress text. Dark posters retain the white logo. Event palette selectors must not recolour the separate world-clock overlay. All decorative art is static local SVG; existing motion and price-ribbon styling remain unchanged.

Activities should be recognisable as new content through their palette and relevant illustration while retaining the shared design language. Do not substitute the old generic blocks or game artwork for these two event illustrations. Keep supporting text legible across the full background gradient, including dates, venue, RSVP, notices, and the integrated clock. Verify both directions of the light/dark poster transition and restoration after a time signal.

## 4. Typography

Use the existing system stack: `Arial, Helvetica, sans-serif`. No network font requests are permitted. A future custom font must be bundled locally and checked for size, loading behavior, and legibility.

| Normal-display role | Current size |
| --- | ---: |
| Main two-line headline | 174 px, weight 700, line-height 0.99 |
| Main supporting sentence | 35 px |
| Event metadata | 24 px |
| Event category | 20 px, tracked uppercase |
| Sample-event label | 16 px |
| Main clock | 63 px, tabular numerals |
| Main date | 22 px |
| Announcement | 22 px |
| Product name | 29 px |
| Product price | 39 px, weight 700, tabular numerals |

Headline line-height, tracking, and safe areas are tuned for the supplied short titles. Do not infer that a string passing validation will necessarily fit at the approved size.

### Editorial limits

| Field | Recommended composition | Current validation ceiling |
| --- | --- | --- |
| Headline | Two short lines, ideally about 12 characters per line | Exactly two lines, at most 22 characters per line |
| Description | One short sentence, about 40 characters | 110 characters |
| Event metadata | A compact time/location statement | 60 characters |
| Announcement | A concise sentence, preferably under 80 characters | 145 characters |
| Product name | Short common name | 24 characters; coffee name 25 |
| Price | CAD currency string, two decimal places in current content | 12 characters |

Prefer editing copy to shrinking important text. Long strings require visual verification on the canvas. Keep `SAMPLE EVENT`, TBD metadata, and demo-price labels until the owner explicitly approves real content.

For owner-approved real events, `isSample: false` removes only the event's sample label and accessible sample suffix. Omitted or `true` retains sample labeling. Real metadata replaces TBD copy; the independent demo-price disclaimer stays until approved separately. A neutral standby poster appears when all events expire.

### Event validity and standby

Use explicit-offset ISO timestamps for absolute validity, with `startsAt` inclusive and `endsAt` exclusive. `startsAt: null` allows immediate promotion, rather than withholding a poster until the event begins. The current November posters have no recurring display window. The event and its corresponding notice must expire together.

| Current event | Advertised Toronto time | Exclusive expiry |
| --- | --- | --- |
| Fumbles & Failures | November 3, 2026, 1–4 PM; BA3200 | `2026-11-03T16:00:00-05:00` |
| Bytes Around the World | November 6, 2026, 3–5 PM; BA3200 | `2026-11-06T17:00:00-05:00` |

The supplied posters omit a year; 2026 follows the owner's October 31 maintenance context, as recorded in README.md. Toronto is on EST for these event dates. Event facts, prices, and validity must not change as a side effect of a visual edit.

Eligibility refreshes once per second without a release or reload. After the first expiry, only Bytes remains. After the second, show the original dark-teal `code` standby poster: “Your space.” / “Your people.”, with “No events are scheduled right now.” and the community-board tag. Do not restore fictional event posters. Expired data stays in the source but is excluded from playback. Keep the price ribbon, ordinary notices, integrated clock, and scheduled world-time broadcasts running. If expiry happens during a broadcast, complete the broadcast and reveal the eligible poster or standby afterward.

## 5. Product ribbon

The bottom ribbon is the only dedicated shop area. Each item contains a small local illustration, a name, and a price. Do not substitute generic separators for the product pictures.

| Property | Current value |
| --- | --- |
| Picture box | 52 × 65 px, `object-fit: contain`, fixed flex size |
| Item internal gap | 20 px |
| Item-group gap | 70 px |
| Default movement | Right to left, about 70 design pixels/second |
| Loop structure | Two equal-width copies; second copy hidden from accessibility |
| Edge treatment | Soft mask at the visible track edges |

Coffee, soda, energy drinks, chips, chocolate, ice cream, and gum use bundled SVG illustrations. These are illustrative drawings, not verified photographs of stock or licensed packaging. Unknown icon names use the local snack fallback.

The player measures one completed group's width when content is rendered and sets the animation duration from that width. The animation uses a CSS transform, not repeated JavaScript position updates. New items must not change one copy without changing the other. Keep picture dimensions fixed so image loading does not change the loop width.

The track must not pause on hover, click, focus, or keyboard input. It pauses during the time signal and resumes afterward. Large product inventories need a specific readability check; do not claim all items fit simultaneously in reduced-motion mode.

## 6. Time-signal composition

Preserve the television-broadcast character: a lime diagonal opening sweep, large numerical time, thin globe/orbit line art, clear city identity, and a restrained page-progress strip. The signal covers the entire canvas, including the shop ribbon.

### Three-page sequence

| Page | Cities, left to right | Approved time |
| --- | --- | --- |
| 1 | Toronto alone | 0–5 s, including entry |
| 2 | Los Angeles, New York, Shanghai, London | 5–12.2 s |
| 3 | Tokyo, Seoul, New Delhi, Sydney | 12.2–19.4 s |
| Exit | Restore the normal poster | 19.4–20 s |

The last two pages show **four tall columns side by side**, not four rows or a 2 × 2 grid. The cities within a page remain visible together. Do not return to one rapid flip per city.

Each city shows its name, three-letter location code, region/country label, 24-hour time with seconds, full local date, UTC offset, and browser-provided zone abbreviation. Dates are essential when another city is already on the following day. Three-letter codes are location labels and must not be used to calculate time.

### Clock sizing

| Role | Toronto page | Four-column pages |
| --- | ---: | ---: |
| City heading | 75 px | 38 px |
| Main hours/minutes | 330 px | 110 px |
| Seconds | 86 px | 35 px |
| Local date | 29 px | 21 px |
| Location code | 148 px | 100 px |
| UTC offset | 44 px | 27 px |

The group area runs from x = 87 to x = 1833, with four equal columns of about 436.5 px. It begins at y = 263 and ends 218 px above the canvas bottom. Separate columns with subtle vertical rules; do not enclose them in cards. The background globe is decorative and must stay quiet behind the numbers.

Scheduling is anchored to `America/Toronto` at `:00`, `:10`, `:20`, `:30`, `:40`, and `:50`. Use IANA timezone identifiers and the browser's timezone rules, including daylight saving and New Delhi's half-hour offset. Do not encode fixed inter-city hour differences. The time signal remains silent; adding audio is a separate product decision.

The approved broadcast lasts **20 seconds**. Reserve each absolute ten-minute deadline with one one-shot timer; do not use an idle polling interval, a grace window, or a deliberate trigger delay. A registered callback delivered late still runs once and then reserves the next actual boundary, avoiding cumulative drift. Opening, returning to the foreground, or restoring a page after a boundary waits for the next boundary. A real scheduled signal takes precedence over an operator preview. Deduplicate only completed scheduled slots; repeated DST hours have distinct absolute slot IDs. Browser scheduling is subject to event-loop responsiveness and is not a hard real-time guarantee.

During the broadcast, suspend poster/notice advancement and pause the price ribbon. At exit restore the current eligible poster, its light/dark masthead colours, and the prior accessibility attributes, with a fresh full poster interval. The regular poster interval remains **14 seconds**; it is separate from the **20-second broadcast duration** and the **10-minute broadcast cadence**. The device's 30-minute release check and the browser's 10-second version check are separate deployment mechanisms.

## 7. Motion and timing

| Motion | Current treatment |
| --- | --- |
| Main poster change | 0.65 s opacity / 10 px vertical transform |
| Main poster interval | 14 s |
| Notice change | 0.35 s opacity / small vertical transform; every 10 s |
| Price ribbon | Continuous horizontal CSS transform |
| Signal opening | 0.42 s arrival plus 0.65 s diagonal sweep |
| Signal page changes | 0.18 s opacity / 0.24 s small vertical transform |
| Signal globe | Small rotation over the finite signal duration |
| Signal exit | 0.6 s opacity / horizontal transform |

Use opacity and transforms for movement. Continuous motion is limited to the requested price ribbon and decorative main-slide progress; the globe and signal progress only animate during a broadcast. Avoid flashing, particle systems, video, WebGL, long chains of timers, and frame-by-frame JavaScript rendering.

Respect `prefers-reduced-motion`. The current implementation suppresses poster/page transitions and signal/globe movement, hides the opening sweep, and stops ribbon movement with smaller static item styles. Recheck content fit when adding products. The three-page timing and timezone content remain meaningful without movement.

## 8. Passive operation and accessibility

- Hide the pointer over page content; compositor-level cursor policy belongs to the device system.
- Keep pointer events disabled on the display stage and text selection disabled.
- Do not add buttons, tabs, links for viewers, hover states, keyboard shortcuts, focus-dependent reveals, or forms to the production screen.
- Progress marks are decorative. Preview and developer APIs are operator tools, not on-screen controls.
- Use real text for headlines, prices, and clock values. Decorative images have empty alt text; the official logo has meaningful alternative text.
- Hide inactive slides/pages and the duplicate ribbon group from the accessibility tree. The broadcast restores the underlay's previous accessibility attributes on exit.
- Keep essential information readable without relying on animation or colour alone.

## 9. Frontend engineering constraints

Keep the runtime buildless and dependency-free. All render-essential images, styles, scripts, and fonts must be local. Preserve relative paths and the existing Content Security Policy. Render editable text through text nodes / `textContent`, not untrusted HTML.

Maintain the clock/event module boundary described in [README.md](README.md). A normal event or shop edit belongs in `content.js`; it must not change the clock config, its timers, its storage key, or the 20-second sequence. Shared canvas, logo, and global-style changes must be verified in both normal and broadcast modes.

Do not enable the optional service worker casually, remove the updater, add external APIs, or move operating-system responsibilities into the page. The provided [deployment contract](docs/DEPLOYMENT-CONTRACT.md) governs production packaging and device-side update behavior.

## 10. Review a change

A design review should answer these questions with the rendered result:

1. Can a passerby identify the primary event at a glance?
2. Does the screen still read as one poster with a single bottom ribbon?
3. Are the headline, product names/prices, and clock values readable at 1920 × 1080 without clipping?
4. Do all product pictures and official brand files load from the bundle?
5. Do the two world-time groups remain four simultaneous portrait columns?
6. Does the complete 20-second signal return to the current event and resume the ribbon?
7. Does the result still work offline and without any input device?
8. Are both November palettes recognisable, with legible masthead/metadata, matching local artwork, and no palette leakage into the world-clock overlay?
9. Do both posters and their notices expire at the specified Toronto end times, leaving a working standby page after the final expiry?

Document material deviations and get direction from the owner when a requested change conflicts with an approved product decision. Do not silently replace the established visual system during routine maintenance.
