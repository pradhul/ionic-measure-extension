# Ionic Measure — Chrome Extension

Pixel-perfect measurement overlay for **Ionic 7/8** apps. Inspect internal dimensions of a selected component or measure spacing between two elements.

## Features

- **Component mode** — click an `ion-*` element (or any node) to show width, height, padding, and margin for the host and its children (configurable depth).
- **Spacing mode** — click two elements to see horizontal and vertical edge-to-edge gaps (Figma-style).
- **Snap to Ionic host** — clicks inside a component promote to the nearest `ion-*` ancestor.
- **Shadow DOM** — hit-testing pierces open shadow roots (Stencil/Ionic components).
- **Scroll-safe** — overlays update on scroll and resize (`ion-content` friendly).

## Install (development)

```bash
npm install
npm run build
```

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select the `dist` folder
4. **Important:** open your Ionic page and press **Refresh (F5)** after loading or updating the extension
5. Toggle **Active** in the popup — you should see a green “Connected” banner and a dark HUD box top-left on the page when hovering

### Nothing happens when I click?

| Check | Fix |
|-------|-----|
| Page opened before install | **Refresh the tab** (F5) |
| Popup says “Page not connected” | Refresh tab, toggle Active again |
| No HUD on hover | Open DevTools → **Console** → select **Ionic Measure** in the context dropdown (not “top”) and check for errors |
| Other extensions same issue | Normal after install — refresh fixes most cases; no special Chrome setting required |

## Usage

1. Open your Ionic app (localhost, staging, or production) in Chrome.
2. Click the extension icon → toggle **Active**.
3. Choose **Component** or **Spacing** mode.
4. Click elements on the page. Press **Esc** to clear selection.
5. Shortcut: **Alt+Shift+M** toggles the overlay.

## Validate on Ionic demos

1. Go to [Ionic Button demo](https://ionicframework.com/docs/demos/api/button/index.html?ionic:mode=ios)
2. Enable the extension, select an `ion-button` in component mode.
3. Switch to spacing mode and select two buttons — compare gaps with DevTools rulers (±1px).

## Project structure

```
src/
  background/     Service worker (commands, popup relay)
  content/        Content script entry
  lib/
    dom.ts        Shadow-piercing picker, Ionic helpers, traversal
    measure.ts    Box model metrics
    spacing.ts    Two-element gap calculation
    overlay.ts    SVG + label renderer (isolated Shadow DOM)
    picker.ts     MeasureController
  popup/          Extension popup UI
```

## Settings (popup)

| Option | Description |
|--------|-------------|
| Mode | Component vs Spacing |
| Depth | Direct children, all descendants, or leaves only |
| Snap to ion-* | Promote selection to Ionic component host |
| Min size | Ignore elements smaller than N px |

## Limitations

- Closed Shadow DOM roots cannot be inspected (rare in Ionic).
- Cross-origin iframes are not measurable.
- Does not run inside Capacitor native WebViews — use Chrome with your deployed URL.

## Scripts

```bash
npm run dev    # Watch build
npm run build  # Production build to dist/
npm run typecheck
```
