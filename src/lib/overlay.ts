import type { BoxMetrics, SpacingResult } from './types';
import type { LayoutSpacing } from './layout-spacing';
import type { AlignmentCompareResult, EdgeGuides, GuideVisibility } from './alignment';
import { attachDraggableHud, setHudContent } from './hud';

const OVERLAY_HOST_ID = 'ionic-measure-extension-host';
const ALIGNMENT_GUIDE_COLOR = '#ec4899';
const ALIGNMENT_SNAP_COLOR = '#f472b6';

const STYLES = `
:host {
  all: initial;
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  pointer-events: none;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
}
.root {
  position: fixed;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}
svg.layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}
.hud-draggable {
  position: fixed;
  top: 12px;
  left: 12px;
  min-width: 200px;
  max-width: 380px;
  background: rgba(15, 23, 42, 0.94);
  color: #e2e8f0;
  border-radius: 8px;
  border: 1px solid rgba(148, 163, 184, 0.4);
  pointer-events: auto;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  line-height: 1.45;
  user-select: none;
}
.hud-handle {
  padding: 6px 10px;
  font-size: 10px;
  font-weight: 700;
  color: #94a3b8;
  cursor: grab;
  border-bottom: 1px solid rgba(148, 163, 184, 0.25);
  letter-spacing: 0.02em;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  touch-action: none;
}
.hud-handle:active { cursor: grabbing; }
.hud-title {
  flex: 1;
}
.hud-collapse-toggle {
  appearance: none;
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 4px;
  background: rgba(30, 41, 59, 0.9);
  color: #e2e8f0;
  font-size: 12px;
  line-height: 1;
  width: 18px;
  height: 18px;
  cursor: pointer;
  pointer-events: auto;
}
.hud-collapse-toggle:hover {
  background: rgba(51, 65, 85, 0.95);
}
.hud-body {
  padding: 8px 10px 10px;
  user-select: text;
  cursor: default;
}
.hud-draggable.is-collapsed .hud-body {
  display: none;
}
.hud-body strong { color: #38bdf8; }
.hud-section {
  margin-top: 8px;
  margin-bottom: 4px;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #94a3b8;
}
.hud-section:first-child { margin-top: 0; }
.hud-row {
  font-size: 11px;
  margin: 2px 0;
  word-break: break-word;
}
.hud-row span { color: #f1f5f9; }
.hud-tag {
  display: inline-block;
  padding: 1px 5px;
  background: rgba(56, 189, 248, 0.15);
  border-radius: 4px;
  color: #7dd3fc;
  font-size: 10px;
  margin-bottom: 6px;
}
.hover-tag {
  position: fixed;
  padding: 4px 8px;
  background: rgba(14, 165, 233, 0.95);
  color: #fff;
  border-radius: 4px;
  white-space: nowrap;
  pointer-events: none;
  font-size: 10px;
  max-width: min(420px, 90vw);
  line-height: 1.35;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
}
.hover-tag .hover-target {
  font-weight: 700;
  display: block;
}
.hover-tag .hover-meta {
  opacity: 0.9;
  font-size: 9px;
}
.badge-layer {
  position: fixed;
  inset: 0;
  pointer-events: none;
}
.spacing-badge {
  position: fixed;
  padding: 2px 6px;
  background: #f59e0b;
  color: #1e293b;
  font-weight: 700;
  border-radius: 4px;
  pointer-events: none;
  font-size: 10px;
  line-height: 1.2;
}
.box-model-label {
  position: fixed;
  padding: 1px 5px;
  font-weight: 700;
  border-radius: 3px;
  pointer-events: none;
  font-size: 9px;
  line-height: 1.2;
  white-space: nowrap;
}
.box-model-label.margin {
  background: rgba(245, 158, 11, 0.92);
  color: #1e293b;
}
.box-model-label.padding {
  background: rgba(74, 222, 128, 0.92);
  color: #14532d;
}
`;

const MARGIN_FILL = 'rgba(245, 158, 11, 0.28)';
const PADDING_FILL = 'rgba(74, 222, 128, 0.28)';
const CHILD_OUTLINE_COLOR = '#94a3b8';
const MAX_LAYOUT_SPACINGS = 24;

export class OverlayRenderer {
  private host: HTMLElement | null = null;
  private shadow: ShadowRoot | null = null;
  private svg: SVGSVGElement | null = null;
  private hoverGroup: SVGGElement | null = null;
  private mainGroup: SVGGElement | null = null;
  private hud: HTMLElement | null = null;
  private hoverTag: HTMLElement | null = null;
  private badgeLayer: HTMLElement | null = null;
  private hudDragLock = false;

  mount(): void {
    if (this.host) return;

    const host = document.createElement('div');
    host.id = OVERLAY_HOST_ID;
    (document.body ?? document.documentElement).appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = STYLES;
    shadow.appendChild(style);

    const root = document.createElement('div');
    root.className = 'root';

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'layer');
    svg.setAttribute('width', String(window.innerWidth));
    svg.setAttribute('height', String(window.innerHeight));
    const mainGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const hoverGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    svg.append(mainGroup, hoverGroup);

    const hud = document.createElement('div');
    attachDraggableHud(
      hud,
      () => {
        this.hudDragLock = true;
      },
      () => {
        this.hudDragLock = false;
      },
    );

    const hoverTag = document.createElement('div');
    hoverTag.className = 'hover-tag';
    hoverTag.hidden = true;

    const badgeLayer = document.createElement('div');
    badgeLayer.className = 'badge-layer';

    root.append(svg);
    shadow.append(root, hud, hoverTag, badgeLayer);

    this.host = host;
    this.shadow = shadow;
    this.svg = svg;
    this.mainGroup = mainGroup;
    this.hoverGroup = hoverGroup;
    this.hud = hud;
    this.hoverTag = hoverTag;
    this.badgeLayer = badgeLayer;
  }

  isHudDragging(): boolean {
    return this.hudDragLock;
  }

  unmount(): void {
    this.host?.remove();
    this.host = null;
    this.shadow = null;
    this.svg = null;
    this.hud = null;
    this.hoverTag = null;
    this.badgeLayer = null;
  }

  resize(): void {
    if (!this.svg) return;
    this.svg.setAttribute('width', String(window.innerWidth));
    this.svg.setAttribute('height', String(window.innerHeight));
  }

  setHud(html: string): void {
    if (this.hud) setHudContent(this.hud, html);
  }

  setHudVisible(visible: boolean): void {
    if (!this.hud) return;
    this.hud.style.display = visible ? 'block' : 'none';
  }

  showHover(rect: DOMRect, targetLabel: string, meta?: string): void {
    if (!this.hoverTag) return;
    this.hoverTag.hidden = false;
    this.hoverTag.innerHTML = meta
      ? `<span class="hover-target">${targetLabel}</span><span class="hover-meta">${meta}</span>`
      : `<span class="hover-target">${targetLabel}</span>`;

    const tagW = this.hoverTag.offsetWidth;
    const tagH = this.hoverTag.offsetHeight;
    const margin = 10;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const clamp = (value: number, min: number, max: number): number =>
      Math.max(min, Math.min(max, value));

    const intersectsTarget = (x: number, y: number): boolean => {
      return !(
        x + tagW < rect.left ||
        x > rect.right ||
        y + tagH < rect.top ||
        y > rect.bottom
      );
    };

    const candidates = [
      { x: rect.right + margin, y: rect.bottom + margin },
      { x: rect.right + margin, y: rect.top - tagH - margin },
      { x: rect.left - tagW - margin, y: rect.bottom + margin },
      { x: rect.left - tagW - margin, y: rect.top - tagH - margin },
    ].map((p) => ({
      x: clamp(p.x, margin, Math.max(margin, vw - tagW - margin)),
      y: clamp(p.y, margin, Math.max(margin, vh - tagH - margin)),
    }));

    const best = candidates.find((p) => !intersectsTarget(p.x, p.y)) ?? candidates[0];
    this.hoverTag.style.left = `${best.x}px`;
    this.hoverTag.style.top = `${best.y}px`;
  }

  drawHoverOutline(rect: DOMRect, hasSelection = false): void {
    this.clearHover();
    const color = hasSelection ? '#94a3b8' : '#0ea5e9';
    const width = hasSelection ? 1.5 : 2;
    this.drawStrokeRect(rect, color, width, '4 3', this.hoverGroup);
  }

  hideHover(): void {
    if (this.hoverTag) this.hoverTag.hidden = true;
  }

  clearDrawings(): void {
    if (this.mainGroup) this.mainGroup.innerHTML = '';
    if (this.hoverGroup) this.hoverGroup.innerHTML = '';
    if (this.badgeLayer) this.badgeLayer.innerHTML = '';
  }

  clearHover(): void {
    if (this.hoverGroup) this.hoverGroup.innerHTML = '';
  }

  drawSelectionOutline(rect: DOMRect): void {
    this.drawStrokeRect(rect, '#22c55e', 2, '6 4', this.mainGroup);
  }

  /** Component mode: Figma-style box model + internal child gaps on canvas. */
  renderComponent(
    metrics: BoxMetrics,
    hudHtml: string,
    childMetrics: BoxMetrics[] = [],
    layoutSpacings: LayoutSpacing[] = [],
  ): void {
    this.clearDrawings();
    this.setHudVisible(false);

    this.drawBoxModelFills(metrics);

    for (const child of childMetrics) {
      this.drawStrokeRect(child.rect, CHILD_OUTLINE_COLOR, 1, '3 2', this.mainGroup);
    }

    const cappedSpacings = layoutSpacings.slice(0, MAX_LAYOUT_SPACINGS);
    for (const { spacing } of cappedSpacings) {
      this.drawSpacingMeasurement(spacing);
    }

    this.drawStrokeRect(metrics.rect, '#38bdf8', 2, undefined, this.mainGroup);
    this.drawBoxModelLabels(metrics);
    this.setHud(hudHtml);
  }

  renderSpacing(
    rectA: DOMRect,
    rectB: DOMRect,
    spacing: SpacingResult,
    labelA: string,
    labelB: string,
  ): void {
    this.clearDrawings();
    this.setHudVisible(false);
    this.drawStrokeRect(rectA, '#a855f7', 2, '4 2', this.mainGroup);
    this.drawStrokeRect(rectB, '#a855f7', 2, '4 2', this.mainGroup);
    this.drawSpacingMeasurement(spacing);

    const parts: string[] = [];
    if (spacing.showHorizontal) parts.push(`H: <strong>${spacing.horizontal}px</strong>`);
    if (spacing.showVertical) parts.push(`V: <strong>${spacing.vertical}px</strong>`);
    if (parts.length === 0) parts.push(`<em>Overlapping — no positive gap</em>`);

    this.setHud(
      `<span class="hud-tag">Spacing mode</span>` +
        `<div class="hud-row">A: <span>${labelA}</span></div>` +
        `<div class="hud-row">B: <span>${labelB}</span></div>` +
        `<div class="hud-row">${parts.join(' · ')}</div>` +
        `<div class="hud-row" style="opacity:0.75;margin-top:6px">Use spacing mode for gaps between elements. Component mode shows CSS on one element.</div>`,
    );
  }

  /** Alignment mode: full-viewport lines from reference left/right/top/bottom edges. */
  renderAlignment(
    refRect: DOMRect,
    guides: EdgeGuides,
    visibility: GuideVisibility,
    hoverRect?: DOMRect,
    compare?: AlignmentCompareResult,
  ): void {
    this.clearDrawings();
    this.setHudVisible(false);
    if (visibility.left || visibility.right || visibility.top || visibility.bottom) {
      this.drawEdgeGuides(guides, visibility);
    }
    this.drawStrokeRect(refRect, '#22c55e', 2, '6 4', this.mainGroup);

    if (hoverRect && compare) {
      this.drawStrokeRect(hoverRect, '#94a3b8', 1.5, '4 3', this.mainGroup);
      this.drawAlignmentSnaps(compare);
    }

  }

  private drawEdgeGuides(guides: EdgeGuides, visibility: GuideVisibility): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (visibility.left) {
      this.drawGuideLine(
        { x1: guides.left, y1: 0, x2: guides.left, y2: h },
        ALIGNMENT_GUIDE_COLOR,
        1,
        '6 4',
      );
    }
    if (visibility.right) {
      this.drawGuideLine(
        { x1: guides.right, y1: 0, x2: guides.right, y2: h },
        ALIGNMENT_GUIDE_COLOR,
        1,
        '6 4',
      );
    }
    if (visibility.top) {
      this.drawGuideLine(
        { x1: 0, y1: guides.top, x2: w, y2: guides.top },
        ALIGNMENT_GUIDE_COLOR,
        1,
        '6 4',
      );
    }
    if (visibility.bottom) {
      this.drawGuideLine(
        { x1: 0, y1: guides.bottom, x2: w, y2: guides.bottom },
        ALIGNMENT_GUIDE_COLOR,
        1,
        '6 4',
      );
    }
  }

  private drawGuideLine(
    line: { x1: number; y1: number; x2: number; y2: number },
    stroke: string,
    width: number,
    dash?: string,
  ): void {
    if (!this.mainGroup) return;
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    el.setAttribute('x1', String(line.x1));
    el.setAttribute('y1', String(line.y1));
    el.setAttribute('x2', String(line.x2));
    el.setAttribute('y2', String(line.y2));
    el.setAttribute('stroke', stroke);
    el.setAttribute('stroke-width', String(width));
    if (dash) el.setAttribute('stroke-dasharray', dash);
    this.mainGroup.appendChild(el);
  }

  private drawAlignmentSnaps(compare: AlignmentCompareResult): void {
    for (const snap of compare.snaps) {
      if (snap.axis === 'vertical') {
        this.drawGuideLine(
          {
            x1: snap.guidePos,
            y1: snap.spanStart,
            x2: snap.guidePos,
            y2: snap.spanEnd,
          },
          ALIGNMENT_SNAP_COLOR,
          3,
        );
      } else {
        this.drawGuideLine(
          {
            x1: snap.spanStart,
            y1: snap.guidePos,
            x2: snap.spanEnd,
            y2: snap.guidePos,
          },
          ALIGNMENT_SNAP_COLOR,
          3,
        );
      }
    }
  }

  private drawBoxModelFills(m: BoxMetrics): void {
    const { rect } = m;
    const marginOuter = {
      left: rect.left - m.marginLeft,
      top: rect.top - m.marginTop,
      right: rect.right + m.marginRight,
      bottom: rect.bottom + m.marginBottom,
    };

    if (m.marginTop > 0) {
      this.drawFillRect(
        marginOuter.left,
        marginOuter.top,
        marginOuter.right - marginOuter.left,
        m.marginTop,
        MARGIN_FILL,
      );
    }
    if (m.marginBottom > 0) {
      this.drawFillRect(
        marginOuter.left,
        rect.bottom,
        marginOuter.right - marginOuter.left,
        m.marginBottom,
        MARGIN_FILL,
      );
    }
    if (m.marginLeft > 0) {
      this.drawFillRect(
        marginOuter.left,
        rect.top,
        m.marginLeft,
        rect.height,
        MARGIN_FILL,
      );
    }
    if (m.marginRight > 0) {
      this.drawFillRect(
        rect.right,
        rect.top,
        m.marginRight,
        rect.height,
        MARGIN_FILL,
      );
    }

    const paddingOuter = {
      left: rect.left + m.borderLeft,
      top: rect.top + m.borderTop,
      right: rect.right - m.borderRight,
      bottom: rect.bottom - m.borderBottom,
    };
    const contentLeft = paddingOuter.left + m.paddingLeft;
    const contentTop = paddingOuter.top + m.paddingTop;
    const contentRight = paddingOuter.right - m.paddingRight;
    const contentBottom = paddingOuter.bottom - m.paddingBottom;

    if (m.paddingTop > 0) {
      this.drawFillRect(
        paddingOuter.left,
        paddingOuter.top,
        paddingOuter.right - paddingOuter.left,
        m.paddingTop,
        PADDING_FILL,
      );
    }
    if (m.paddingBottom > 0) {
      this.drawFillRect(
        paddingOuter.left,
        paddingOuter.bottom - m.paddingBottom,
        paddingOuter.right - paddingOuter.left,
        m.paddingBottom,
        PADDING_FILL,
      );
    }
    if (m.paddingLeft > 0) {
      this.drawFillRect(
        paddingOuter.left,
        contentTop,
        m.paddingLeft,
        Math.max(0, contentBottom - contentTop),
        PADDING_FILL,
      );
    }
    if (m.paddingRight > 0) {
      this.drawFillRect(
        contentRight,
        contentTop,
        m.paddingRight,
        Math.max(0, contentBottom - contentTop),
        PADDING_FILL,
      );
    }
  }

  private drawBoxModelLabels(m: BoxMetrics): void {
    const { rect } = m;
    const marginOuter = {
      left: rect.left - m.marginLeft,
      top: rect.top - m.marginTop,
      right: rect.right + m.marginRight,
      bottom: rect.bottom + m.marginBottom,
    };
    const paddingOuter = {
      left: rect.left + m.borderLeft,
      top: rect.top + m.borderTop,
      right: rect.right - m.borderRight,
      bottom: rect.bottom - m.borderBottom,
    };
    const contentLeft = paddingOuter.left + m.paddingLeft;
    const contentTop = paddingOuter.top + m.paddingTop;
    const contentRight = paddingOuter.right - m.paddingRight;
    const contentBottom = paddingOuter.bottom - m.paddingBottom;

    if (m.marginTop > 0) {
      this.addBoxModelLabel(
        (marginOuter.left + marginOuter.right) / 2,
        marginOuter.top + m.marginTop / 2,
        `${m.marginTop}`,
        'margin',
      );
    }
    if (m.marginBottom > 0) {
      this.addBoxModelLabel(
        (marginOuter.left + marginOuter.right) / 2,
        rect.bottom + m.marginBottom / 2,
        `${m.marginBottom}`,
        'margin',
      );
    }
    if (m.marginLeft > 0) {
      this.addBoxModelLabel(
        marginOuter.left + m.marginLeft / 2,
        (rect.top + rect.bottom) / 2,
        `${m.marginLeft}`,
        'margin',
      );
    }
    if (m.marginRight > 0) {
      this.addBoxModelLabel(
        rect.right + m.marginRight / 2,
        (rect.top + rect.bottom) / 2,
        `${m.marginRight}`,
        'margin',
      );
    }

    if (m.paddingTop > 0) {
      this.addBoxModelLabel(
        (paddingOuter.left + paddingOuter.right) / 2,
        paddingOuter.top + m.paddingTop / 2,
        `${m.paddingTop}`,
        'padding',
      );
    }
    if (m.paddingBottom > 0) {
      this.addBoxModelLabel(
        (paddingOuter.left + paddingOuter.right) / 2,
        paddingOuter.bottom - m.paddingBottom / 2,
        `${m.paddingBottom}`,
        'padding',
      );
    }
    if (m.paddingLeft > 0) {
      this.addBoxModelLabel(
        paddingOuter.left + m.paddingLeft / 2,
        (contentTop + contentBottom) / 2,
        `${m.paddingLeft}`,
        'padding',
      );
    }
    if (m.paddingRight > 0) {
      this.addBoxModelLabel(
        contentRight + m.paddingRight / 2,
        (contentTop + contentBottom) / 2,
        `${m.paddingRight}`,
        'padding',
      );
    }
  }

  private drawFillRect(
    left: number,
    top: number,
    width: number,
    height: number,
    fill: string,
  ): void {
    if (!this.mainGroup || width <= 0 || height <= 0) return;
    const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    r.setAttribute('x', String(left));
    r.setAttribute('y', String(top));
    r.setAttribute('width', String(width));
    r.setAttribute('height', String(height));
    r.setAttribute('fill', fill);
    r.setAttribute('stroke', 'none');
    this.mainGroup.appendChild(r);
  }

  private addBoxModelLabel(
    x: number,
    y: number,
    text: string,
    kind: 'margin' | 'padding',
  ): void {
    if (!this.badgeLayer) return;
    const badge = document.createElement('div');
    badge.className = `box-model-label ${kind}`;
    badge.textContent = text;
    badge.style.left = `${x}px`;
    badge.style.top = `${y}px`;
    badge.style.transform = 'translate(-50%, -50%)';
    this.badgeLayer.appendChild(badge);
  }

  private drawStrokeRect(
    rect: DOMRect | { left: number; top: number; width: number; height: number },
    stroke: string,
    width: number,
    dash?: string,
    parent: SVGGElement | null = this.mainGroup,
  ): void {
    if (!parent || rect.width <= 0 || rect.height <= 0) return;
    const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    r.setAttribute('x', String(rect.left));
    r.setAttribute('y', String(rect.top));
    r.setAttribute('width', String(rect.width));
    r.setAttribute('height', String(rect.height));
    r.setAttribute('fill', 'none');
    r.setAttribute('stroke', stroke);
    r.setAttribute('stroke-width', String(width));
    if (dash) r.setAttribute('stroke-dasharray', dash);
    parent.appendChild(r);
  }

  private drawSpacingMeasurement(spacing: SpacingResult): void {
    if (spacing.showHorizontal) {
      this.drawLine(spacing.horizontalLine, '#f59e0b');
      this.addSpacingBadge(
        spacing.labelH.x,
        spacing.labelH.y,
        `${spacing.horizontal}px`,
      );
    }
    if (spacing.showVertical) {
      this.drawLine(spacing.verticalLine, '#f59e0b');
      this.addSpacingBadge(
        spacing.labelV.x,
        spacing.labelV.y,
        `${spacing.vertical}px`,
      );
    }
  }

  private drawLine(
    line: { x1: number; y1: number; x2: number; y2: number },
    stroke: string,
  ): void {
    if (!this.mainGroup) return;
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    el.setAttribute('x1', String(line.x1));
    el.setAttribute('y1', String(line.y1));
    el.setAttribute('x2', String(line.x2));
    el.setAttribute('y2', String(line.y2));
    el.setAttribute('stroke', stroke);
    el.setAttribute('stroke-width', '2');
    el.setAttribute('stroke-dasharray', '4 3');
    this.mainGroup.appendChild(el);
  }

  private addSpacingBadge(x: number, y: number, text: string): void {
    if (!this.badgeLayer) return;
    const badge = document.createElement('div');
    badge.className = 'spacing-badge';
    badge.textContent = text;
    badge.style.left = `${x}px`;
    badge.style.top = `${y}px`;
    badge.style.transform = 'translate(-50%, -50%)';
    this.badgeLayer.appendChild(badge);
  }
}
