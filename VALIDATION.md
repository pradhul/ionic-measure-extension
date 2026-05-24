# Validation checklist

## Automated

```bash
npm run test      # Spacing + alignment math unit tests
npm run build     # Typecheck + Vite production bundle
```

## Manual — Ionic Button demo

URL: https://ionicframework.com/docs/demos/api/button/index.html?ionic:mode=ios

1. Load unpacked extension from `dist/`.
2. Open the demo URL, refresh once after install.
3. Toggle **Active** in the popup.
4. **Component mode** + **Snap to ion-***: click a button label → selection should snap to `ion-button`; orange/green overlays and `W×H` labels appear.
5. **Spacing mode**: click two buttons → orange dashed lines and H/V px badges; compare with DevTools (±1px).
6. **Alignment mode**: click one button → pink lines from its left/right/top/bottom edges; hover another → HUD shows edge matches; click reference again to hide/show guides.
7. Scroll the page (if applicable) → overlays stay aligned.
8. Press **Esc** → selection clears.

## Manual — List / ion-item (optional)

URL: https://ionicframework.com/docs/demos/api/list/index.html?ionic:mode=ios

Repeat component + spacing checks on `ion-item` rows.

## Expected results

| Check | Pass criteria |
|-------|----------------|
| Shadow piercing | Click inside button text still selects `ion-button` when snap is on |
| Component batch | Host + direct shadow/slot children show simultaneous labels |
| Spacing | H/V gaps match DevTools ruler |
| Alignment | L/R/T/B lines track reference on scroll; edge deltas on hover |
| Scroll | Labels track elements after `ion-content` scroll |
