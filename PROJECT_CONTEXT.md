# Ionic Measure — Project Context

Load this file as context in Cursor chats when working on the Ionic Measure Chrome extension. It summarizes purpose, architecture, key files, decisions, and known limitations.

---

## What this extension is

**Ionic Measure** is a Chrome-only browser extension that adds a pixel-perfect measurement overlay on web pages. It is built for developers and designers working on **Ionic 7/8** apps (Stencil web components, Shadow DOM, `ion-content` scrolling), especially those using **Angular** with Ionic.

The extension lets you inspect CSS box-model dimensions on a single element, measure edge-to-edge gaps between two elements (Figma-style), or check alignment via full-screen extension lines from a reference element’s left, right, top, and bottom edges. It runs entirely in the browser via a content script; it does not modify the host app.

**Target environment:** Ionic apps served in Chrome (localhost, staging, production). Not intended for Capacitor native WebViews.

---

## Three measurement modes

### Component mode

- Click **one** element to inspect it.
- Shows **CSS spacing and sizing** for that element only: width/height, margin, padding, border, gap, border-radius, min/max dimensions, box-sizing.
- For text-bearing elements, also shows **typography** (font, weight, line-height, letter-spacing, color).
- On-canvas guides are **minimal**: dashed orange margin outline, green padding outline, blue border box. Detailed numbers live in the **HUD** panel.
- Does **not** draw inter-element gaps between children or siblings. Use Spacing mode for gaps between two elements.

### Spacing mode

- Click **two** elements (A, then B) to measure the gap between them.
- Computes **horizontal** and **vertical** edge-to-edge distances (positive gaps only).
- Overlapping or nested elements show no gap lines; the HUD displays *"Overlapping — no positive gap"*.
- Optional **snap to `ion-*` host** (off by default): when enabled, clicks promote to the nearest Ionic component ancestor instead of the exact DOM node under the cursor.

### Alignment mode

- Click **one** element to set a **reference**; draws full-viewport **pink dashed lines** from its **left, right, top, and bottom** edges (Figma-style edge guides).
- **Hover** another element: pink **snap highlights** on matching guide lines; HUD lists aligned edges only (e.g. `Left edges · Top edges`) or `Not aligned` — no pixel readouts.
- **Click the same reference again** to toggle guides on/off; click a different element to move the reference.
- Optional **snap to `ion-*` host** applies to alignment picks when enabled (same as spacing).

Press **Esc** or use **Clear selection** in the popup to reset. **Alt+Shift+M** toggles the overlay on the active tab.

---

## Architecture

| Layer | Role |
|-------|------|
| **Manifest V3** | `manifest.config.ts` — permissions, content script, service worker, popup, keyboard command |
| **Vite + CRXJS** | Bundles TypeScript; `@crxjs/vite-plugin` wires MV3 entry points into `dist/` |
| **Service worker** | `src/background/service-worker.ts` — relays popup messages to tabs, injects content script if missing, handles `Alt+Shift+M` |
| **Content script** | `src/content/content.ts` — loads settings from `chrome.storage.local`, creates/destroys `MeasureController` |
| **MeasureController** | `src/lib/picker.ts` — mouse/keyboard listeners, selection state, coordinates overlay + scroll tracking |
| **Overlay (Shadow DOM)** | `src/lib/overlay.ts` — fixed host `#ionic-measure-extension-host` with open shadow root; SVG drawings + HUD + hover tag; isolated from page CSS |
| **Draggable HUD** | `src/lib/hud.ts` — drag handle, body content, position persisted in `chrome.storage.local` |

**Message flow:** Popup → service worker → `chrome.tabs.sendMessage` → content script (`GET_STATE`, `UPDATE_SETTINGS`, `TOGGLE`, `CLEAR`, `PING`). If the content script is not loaded (common right after install), the service worker **injects** it via `chrome.scripting.executeScript` and retries.

**State:** Settings stored under `chrome.storage.local.settings`. HUD position stored under `hudPosition`. On install/update, settings reset with `active: false`.

---

## Key source files

### `src/lib/`

| File | Purpose |
|------|---------|
| `types.ts` | Shared types (`ExtensionSettings`, `BoxMetrics`, `SpacingResult`) and `DEFAULT_SETTINGS` |
| `dom.ts` | Shadow-piercing hit test (`deepElementFromPoint`, `pierceAllShadows`), Ionic helpers (`findNearestIonHost`, `isIonHost`), hover labels, Stencil `componentOnReady` |
| `picker.ts` | `MeasureController` — mode logic, event handlers, selection state, refresh on scroll/resize |
| `measure.ts` | Reads computed box model (margin, padding, border, dimensions) for one element |
| `spacing.ts` | Two-element gap math; positive-only axis visibility (`showHorizontal` / `showVertical`) |
| `alignment.ts` | Edge extension guides (L/R/T/B); hover edge-to-edge compare and snap segments |
| `spacing-styles.ts` | Formats computed CSS spacing properties for the HUD |
| `typography.ts` | Detects text elements and formats font/line-height/color for the HUD |
| `overlay.ts` | Shadow DOM overlay renderer — SVG outlines, spacing lines, badges, HUD mount |
| `hud.ts` | Draggable HUD chrome; load/save position |
| `scroll-tracker.ts` | Finds scrollable ancestors (including `ion-content` inner scroll) and rAF-throttled scroll listeners |
| `layout-spacing.ts` | Legacy helper for parent/child and sibling gap batching — **not wired into current UI** |
| `spacing.test.ts` | Node unit tests for spacing math (`npm run test`) |
| `alignment.test.ts` | Node unit tests for alignment math (`npm run test`) |

### Entry points

| Path | Purpose |
|------|---------|
| `src/content/content.ts` | Content script entry; message handler; lazy `MeasureController` lifecycle |
| `src/background/service-worker.ts` | MV3 background: popup relay, tab messaging, content-script injection fallback |
| `src/popup/popup.html` | Popup markup (active toggle, mode, snap, min size, clear) |
| `src/popup/popup.ts` | Popup logic — read/write settings, connection banner |
| `src/popup/popup.css` | Popup styling |

### Config / build

| File | Purpose |
|------|---------|
| `manifest.config.ts` | CRXJS manifest definition (MV3) |
| `vite.config.ts` | Vite + CRXJS plugin config |
| `package.json` | Scripts: `build`, `dev`, `typecheck`, `test` |

---

## Technical decisions

### Shadow-piercing hit test

Ionic/Stencil components use **open** Shadow DOM. `elementsFromPoint` returns shadow hosts; the extension must descend into shadow roots to pick the actual target.

- `deepElementFromPoint` picks the **smallest visible element** at `(x, y)` across the document and open shadow trees.
- `pierceAllShadows` walks open shadow roots with a **visited set** and **max depth (32)**. It does **not** recursively call full hit-test from inner elements (that caused **stack overflow** on deep Ionic trees).
- `deepestElementInShadow` scans `elementsFromPoint` inside one shadow root and picks the smallest-area candidate, excluding the host and overlay.

### Scroll tracking for `ion-content`

Ionic scroll often happens inside shadow DOM (`.inner-scroll`, `[part="scroll"]`). `ScrollTracker` attaches passive capture listeners on:

- `window`
- overflow scroll ancestors
- inner scroll containers found in open shadow roots

On scroll or `ResizeObserver` layout change, overlays **refresh**. If a selected element leaves the viewport, selection is **cleared**.

### Snap to Ionic host (optional)

- **Default: off** (`snapToIonHost: false`).
- When off, selection is the **exact element under the cursor** (any tag — `motion.div`, `span`, inner button text, etc.).
- When on, in **Spacing** or **Alignment** mode, clicks promote to the nearest `ion-*` ancestor via `findNearestIonHost`.

### Component mode: no inter-element gaps

Component mode focuses on **one element's CSS**. Gap lines between children/siblings were removed from the overlay; `layout-spacing.ts` remains as unused legacy code. Use **Spacing mode** for Figma-style gaps between two picks.

### Lighter on-canvas overlays

Component mode keeps the page readable: thin margin/padding guides plus a blue border box. Numbers and typography appear in the **HUD**, not as dense on-page labels.

### Overlay isolation

The overlay host uses **open Shadow DOM** with `pointer-events: none` on the root; only the HUD has `pointer-events: auto`. Clicks on the page are intercepted in capture phase unless the user is dragging the HUD.

---

## Build and load (development)

```bash
cd /Users/pradhuldev/ionic-measure-extension
npm install
npm run build    # tsc --noEmit && vite build → dist/
```

**Load in Chrome:**

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select the `dist/` folder
4. **Refresh (F5)** any Ionic tab that was open before install or update
5. Open the extension popup → toggle **Active**

After code changes: run `npm run build`, click **Reload** on the extension card, then **refresh the target tab**.

**Watch mode:** `npm run dev` rebuilds on file changes.

**Validate:** See `VALIDATION.md` and Ionic Button demo URL in `README.md`. Run `npm run test` for spacing math.

---

## Known limitations

| Limitation | Detail |
|------------|--------|
| **Chrome only** | Not Firefox/Safari; uses MV3 APIs |
| **Capacitor WebView** | Extension does not run inside native app WebViews — use Chrome with the deployed URL |
| **Closed Shadow DOM** | Cannot pierce closed roots (rare in Ionic; Stencil uses open mode) |
| **Cross-origin iframes** | Content script cannot measure inside inaccessible iframes |
| **Tab refresh after install** | MV3 content scripts attach on navigation; existing tabs need F5 |
| **`depthFilter` / `minSizePx`** | Stored in settings; `depthFilter` hardcoded to `'direct'` in popup; `minSizePx` not yet applied in picker logic |

---

## Settings (popup and defaults)

Defined in `src/lib/types.ts` as `DEFAULT_SETTINGS`:

| Setting | Default | Popup control | Notes |
|---------|---------|---------------|-------|
| `active` | `false` | Active toggle | Resets to false on extension install/update |
| `mode` | `'component'` | Mode select | `'component'`, `'spacing'`, or `'alignment'` |
| `snapToIonHost` | **`false`** | "Optional: snap spacing/alignment picks to ion-* host" | Spacing and alignment modes |
| `depthFilter` | `'direct'` | *(not exposed)* | Hardcoded in popup; legacy field |
| `minSizePx` | `2` | Min element size (px) | Persisted; picker does not filter by it yet |

HUD position is separate (`hudPosition` in storage), default top-left `(12, 12)`.

---

## Evolution — features built through development

Chronological summary of major iterations (from initial POC through current behavior):

1. **POC** — MV3 extension with Vite/CRXJS, content script overlay, Component and Spacing modes, basic box-model readout.
2. **Connection fixes** — Service worker injects content script when `sendMessage` fails; popup connection banner; "refresh tab" guidance; `PING` / `GET_STATE` handshake.
3. **Positive-only spacing** — `computeSpacing` shows H/V lines and badges only when elements are separated on that axis with **gap > 0**; overlapping picks show a clear HUD message.
4. **Lighter overlays** — Component mode moved detailed metrics into the HUD; on-canvas drawing reduced to margin/padding/border guides.
5. **Typography in HUD** — `typography.ts` adds font size, family, weight, line-height, letter-spacing, color for text-bearing elements.
6. **Draggable HUD** — `hud.ts` adds drag handle, drag lock during move (ignores hover/click), persisted position.
7. **Scroll sync** — `scroll-tracker.ts` listens on `ion-content` inner scroll and overflow ancestors; overlays track on scroll/resize; clears selection when element scrolls out of view.
8. **Any-element selection** — Default pick is the exact node under the cursor; snap to `ion-*` is optional in spacing/alignment (was previously more aggressive).
9. **Stack overflow fix** — Shadow piercing rewritten: `pierceAllShadows` with depth cap and visited set instead of recursive full hit-test re-entry on deep Ionic shadow trees.
10. **Alignment mode** — Full-viewport lines from reference L/R/T/B edges; hover compares edge alignment; click reference toggles guides (`alignment.ts`).

---

## Quick reference — npm scripts

| Script | Command |
|--------|---------|
| Build | `npm run build` |
| Watch | `npm run dev` |
| Typecheck | `npm run typecheck` |
| Test spacing + alignment math | `npm run test` |

---

## Related docs in repo

- `README.md` — user-facing install and usage
- `VALIDATION.md` — manual and automated validation checklist

**Do not edit** `.cursor/plans` plan files when updating this context doc; maintain `PROJECT_CONTEXT.md` at the project root instead.
