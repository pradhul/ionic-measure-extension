import {
  collectComponentChildren,
  deepElementFromPoint,
  describeElementForHover,
  elementLabel,
  ensureComponentReady,
  findNearestIonHost,
  isIonHost,
} from './dom';
import { buildComponentLayoutSpacings } from './layout-spacing';
import { measureElement } from './measure';
import { getSpacingStyles, formatSpacingStylesHtml } from './spacing-styles';
import {
  getTypography,
  isTextElement,
  formatTypographyHtml,
} from './typography';
import { computeSpacing } from './spacing';
import {
  ALL_GUIDES_VISIBLE,
  compareToGuides,
  getEdgeGuides,
  toggleGuideVisibility,
} from './alignment';
import { OverlayRenderer } from './overlay';
import { isElementInViewport, ScrollTracker } from './scroll-tracker';
import type { ExtensionSettings } from './types';

export class MeasureController {
  private overlay = new OverlayRenderer();
  private settings: ExtensionSettings;
  private active = false;
  private componentRoot: Element | null = null;
  private spacingA: Element | null = null;
  private spacingB: Element | null = null;
  private alignmentRef: Element | null = null;
  private alignmentHover: Element | null = null;
  private alignmentGuideVisibility = { ...ALL_GUIDES_VISIBLE };
  private observed: ResizeObserver | null = null;
  private scrollTracker = new ScrollTracker();
  private boundMouseMove = (e: MouseEvent) => this.onMouseMove(e);
  private boundClick = (e: MouseEvent) => this.onClick(e);
  private boundKeyDown = (e: KeyboardEvent) => this.onKeyDown(e);
  private boundResize = () => {
    this.overlay.resize();
    this.refresh();
  };

  constructor(settings: ExtensionSettings) {
    this.settings = { ...settings };
  }

  updateSettings(settings: Partial<ExtensionSettings>): void {
    if (settings.mode && settings.mode !== this.settings.mode) {
      this.componentRoot = null;
      this.spacingA = null;
      this.spacingB = null;
      this.alignmentRef = null;
      this.alignmentHover = null;
      this.alignmentGuideVisibility = { ...ALL_GUIDES_VISIBLE };
    }
    this.settings = { ...this.settings, ...settings };
    this.refresh();
  }

  start(): void {
    if (this.active) return;
    this.active = true;
    this.overlay.mount();
    this.overlay.setHudVisible(false);
    document.addEventListener('mousemove', this.boundMouseMove, true);
    document.addEventListener('click', this.boundClick, true);
    document.addEventListener('keydown', this.boundKeyDown, true);
    window.addEventListener('resize', this.boundResize);
    this.attachScrollTracking();
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    document.removeEventListener('mousemove', this.boundMouseMove, true);
    document.removeEventListener('click', this.boundClick, true);
    document.removeEventListener('keydown', this.boundKeyDown, true);
    window.removeEventListener('resize', this.boundResize);
    this.scrollTracker.unwatch();
    this.observed?.disconnect();
    this.observed = null;
    this.componentRoot = null;
    this.spacingA = null;
    this.spacingB = null;
    this.alignmentRef = null;
    this.alignmentHover = null;
    this.overlay.unmount();
  }

  clearSelection(): void {
    this.componentRoot = null;
    this.spacingA = null;
    this.spacingB = null;
    this.alignmentRef = null;
    this.alignmentHover = null;
    this.overlay.clearDrawings();
    this.overlay.clearHover();
    this.overlay.hideHover();
    this.overlay.setHudVisible(false);
    this.attachScrollTracking();
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.clearSelection();
    }
  }

  /** Exact element under cursor; optional ion snap in spacing/alignment when enabled. */
  private pickAt(x: number, y: number): Element | null {
    const raw = deepElementFromPoint(document, x, y);
    if (!raw) return null;

    if (
      (this.settings.mode === 'spacing' || this.settings.mode === 'alignment') &&
      this.settings.snapToIonHost
    ) {
      return findNearestIonHost(raw);
    }
    return raw;
  }

  private hasSelection(): boolean {
    return Boolean(this.componentRoot || this.spacingA || this.alignmentRef);
  }

  private getSelectedElements(): Element[] {
    const out: Element[] = [];
    if (this.componentRoot) out.push(this.componentRoot);
    if (this.spacingA) out.push(this.spacingA);
    if (this.spacingB) out.push(this.spacingB);
    if (this.alignmentRef) out.push(this.alignmentRef);
    return out;
  }

  private detectPaddingSide(
    metrics: ReturnType<typeof measureElement>,
    x: number,
    y: number,
  ): 'top' | 'right' | 'bottom' | 'left' | null {
    const { rect } = metrics;
    const paddingBoxLeft = rect.left + metrics.borderLeft;
    const paddingBoxRight = rect.right - metrics.borderRight;
    const paddingBoxTop = rect.top + metrics.borderTop;
    const paddingBoxBottom = rect.bottom - metrics.borderBottom;

    const contentLeft = paddingBoxLeft + metrics.paddingLeft;
    const contentRight = paddingBoxRight - metrics.paddingRight;
    const contentTop = paddingBoxTop + metrics.paddingTop;
    const contentBottom = paddingBoxBottom - metrics.paddingBottom;

    const insidePaddingBox =
      x >= paddingBoxLeft &&
      x <= paddingBoxRight &&
      y >= paddingBoxTop &&
      y <= paddingBoxBottom;
    const insideContentBox =
      x >= contentLeft &&
      x <= contentRight &&
      y >= contentTop &&
      y <= contentBottom;

    if (!insidePaddingBox || insideContentBox) return null;

    const distances = [
      { side: 'top' as const, value: Math.abs(y - contentTop), enabled: metrics.paddingTop > 0 },
      { side: 'right' as const, value: Math.abs(x - contentRight), enabled: metrics.paddingRight > 0 },
      { side: 'bottom' as const, value: Math.abs(y - contentBottom), enabled: metrics.paddingBottom > 0 },
      { side: 'left' as const, value: Math.abs(x - contentLeft), enabled: metrics.paddingLeft > 0 },
    ].filter((item) => item.enabled);

    if (distances.length === 0) return null;
    distances.sort((a, b) => a.value - b.value);
    return distances[0]?.side ?? null;
  }

  private componentHoverMeta(target: Element, x: number, y: number): string {
    const metrics = measureElement(target);
    const paddingSide = this.detectPaddingSide(metrics, x, y);
    const roundedWidth = Math.round(metrics.width);
    const roundedHeight = Math.round(metrics.height);

    if (paddingSide === 'top') {
      return `Padding Top: ${metrics.paddingTop}px • Element: ${roundedWidth}x${roundedHeight}px`;
    }
    if (paddingSide === 'right') {
      return `Padding Right: ${metrics.paddingRight}px • Element: ${roundedWidth}x${roundedHeight}px`;
    }
    if (paddingSide === 'bottom') {
      return `Padding Bottom: ${metrics.paddingBottom}px • Element: ${roundedWidth}x${roundedHeight}px`;
    }
    if (paddingSide === 'left') {
      return `Padding Left: ${metrics.paddingLeft}px • Element: ${roundedWidth}x${roundedHeight}px`;
    }

    return (
      `Element: ${roundedWidth}x${roundedHeight}px • ` +
      `Padding (T/R/B/L): ${metrics.paddingTop}/${metrics.paddingRight}/${metrics.paddingBottom}/${metrics.paddingLeft}px • ` +
      `Margin (T/R/B/L): ${metrics.marginTop}/${metrics.marginRight}/${metrics.marginBottom}/${metrics.marginLeft}px`
    );
  }

  private onMouseMove(e: MouseEvent): void {
    if (this.overlay.isHudDragging()) return;

    const target = this.pickAt(e.clientX, e.clientY);
    if (!target) {
      this.overlay.hideHover();
      return;
    }

    const rect = target.getBoundingClientRect();
    const label = elementLabel(target);
    const fallbackMeta = describeElementForHover(target).replace(`${label} · `, '');
    const meta =
      this.settings.mode === 'component'
        ? this.componentHoverMeta(target, e.clientX, e.clientY)
        : fallbackMeta;

    this.overlay.showHover(rect, label, meta);

    if (this.settings.mode === 'alignment' && this.alignmentRef) {
      this.alignmentHover = target;
      void this.renderAlignment(this.alignmentRef, target);
      return;
    }

    this.overlay.drawHoverOutline(rect, this.hasSelection());
  }

  private isEventOnOverlay(e: Event): boolean {
    const host = document.getElementById('ionic-measure-extension-host');
    if (!host) return false;
    return e.composedPath().includes(host);
  }

  private async onClick(e: MouseEvent): Promise<void> {
    if (this.overlay.isHudDragging() || this.isEventOnOverlay(e)) return;

    e.preventDefault();
    e.stopPropagation();

    const target = this.pickAt(e.clientX, e.clientY);
    if (!target) return;

    await ensureComponentReady(target);

    if (this.settings.mode === 'component') {
      this.componentRoot = target;
      this.spacingA = null;
      this.spacingB = null;
      this.alignmentRef = null;
      this.alignmentHover = null;
      this.alignmentGuideVisibility = { ...ALL_GUIDES_VISIBLE };
      await this.renderComponent();
    } else if (this.settings.mode === 'spacing') {
      this.componentRoot = null;
      this.alignmentRef = null;
      this.alignmentHover = null;
      this.alignmentGuideVisibility = { ...ALL_GUIDES_VISIBLE };
      if (!this.spacingA) {
        this.spacingA = target;
        this.spacingB = null;
        await this.renderSpacingPartialA(target);
      } else if (!this.spacingB) {
        this.spacingB = target;
        await this.renderSpacing();
      } else {
        this.spacingA = target;
        this.spacingB = null;
        await this.renderSpacingPartialA(target);
      }
    } else {
      this.componentRoot = null;
      this.spacingA = null;
      this.spacingB = null;
      if (this.alignmentRef === target) {
        this.alignmentGuideVisibility = toggleGuideVisibility(
          this.alignmentGuideVisibility,
        );
      } else {
        this.alignmentRef = target;
        this.alignmentGuideVisibility = { ...ALL_GUIDES_VISIBLE };
      }
      this.alignmentHover = null;
      await this.renderAlignment(this.alignmentRef);
    }
    this.attachScrollTracking();
  }

  private async renderSpacingPartialA(target: Element): Promise<void> {
    const rect = target.getBoundingClientRect();
    this.overlay.clearDrawings();
    this.overlay.setHudVisible(false);
    this.overlay.drawSelectionOutline(rect);
    let hud =
      `<span class="hud-tag">Spacing mode</span>` +
      `<div class="hud-row">A: <span>${elementLabel(target)}</span></div>`;
    const ion = findNearestIonHost(target);
    if (isIonHost(ion) && ion !== target) {
      hud += `<div class="hud-row">ion host: <span>${elementLabel(ion)}</span></div>`;
    }
    hud += `<div class="hud-row">Click second element</div>`;
    this.overlay.setHud(hud);
  }

  private buildComponentHudHtml(
    el: Element,
    metrics: ReturnType<typeof measureElement>,
  ): string {
    const styles = getSpacingStyles(el);
    let html =
      `<span class="hud-tag">Component</span>` +
      `<div class="hud-row"><span>${metrics.tagName}</span></div>` +
      formatSpacingStylesHtml(styles, metrics);

    if (isTextElement(el)) {
      html += formatTypographyHtml(getTypography(el));
    }

    const ion = findNearestIonHost(el);
    if (isIonHost(ion) && ion !== el) {
      html += `<div class="hud-row">ion host: <span>${elementLabel(ion)}</span></div>`;
    }

    html +=
      `<div class="hud-row" style="opacity:0.7;margin-top:8px">` +
      `Orange = margin · green = padding · blue = border · gray = children</div>`;

    return html;
  }

  private async renderAlignment(
    ref: Element,
    hover?: Element,
  ): Promise<void> {
    await ensureComponentReady(ref);
    const refRect = ref.getBoundingClientRect();
    const guides = getEdgeGuides(refRect);
    const visibility = this.alignmentGuideVisibility;

    if (hover) {
      await ensureComponentReady(hover);
      const hoverRect = hover.getBoundingClientRect();
      const compare = compareToGuides(refRect, hoverRect, visibility);
      this.overlay.renderAlignment(
        refRect,
        guides,
        visibility,
        hoverRect,
        compare,
      );
      return;
    }

    this.overlay.renderAlignment(
      refRect,
      guides,
      visibility,
    );
  }

  private async renderComponent(): Promise<void> {
    if (!this.componentRoot) return;
    await ensureComponentReady(this.componentRoot);

    const el = this.componentRoot;
    const children = collectComponentChildren(
      el,
      this.settings.depthFilter,
      this.settings.minSizePx,
    );
    const { rootMetrics, childMetrics, spacings } = buildComponentLayoutSpacings(
      el,
      children,
    );
    const hudHtml = this.buildComponentHudHtml(el, rootMetrics);

    this.overlay.renderComponent(rootMetrics, hudHtml, childMetrics, spacings);
  }

  private async renderSpacing(): Promise<void> {
    if (!this.spacingA || !this.spacingB) return;
    await ensureComponentReady(this.spacingA);
    await ensureComponentReady(this.spacingB);
    const rectA = this.spacingA.getBoundingClientRect();
    const rectB = this.spacingB.getBoundingClientRect();
    const spacing = computeSpacing(rectA, rectB);
    this.overlay.renderSpacing(
      rectA,
      rectB,
      spacing,
      elementLabel(this.spacingA),
      elementLabel(this.spacingB),
    );
  }

  private onScrollOrLayoutChange(): void {
    const selected = this.getSelectedElements();
    for (const el of selected) {
      if (!el.isConnected || !isElementInViewport(el)) {
        this.clearSelection();
        this.overlay.setHud(
          `<span class="hud-tag">Scrolled away</span>` +
            `<div class="hud-row">Selection cleared — element left the view</div>`,
        );
        return;
      }
    }
    this.refresh();
  }

  private refresh(): void {
    if (!this.active) return;
    this.overlay.resize();
    this.overlay.setHudVisible(false);
    if (this.settings.mode === 'component' && this.componentRoot) {
      void this.renderComponent();
    } else if (this.settings.mode === 'spacing' && this.spacingA && this.spacingB) {
      void this.renderSpacing();
    } else if (this.settings.mode === 'spacing' && this.spacingA) {
      void this.renderSpacingPartialA(this.spacingA);
    } else if (this.settings.mode === 'alignment' && this.alignmentRef) {
      void this.renderAlignment(this.alignmentRef, this.alignmentHover ?? undefined);
    }
  }

  private attachScrollTracking(): void {
    const elements = this.getSelectedElements();
    if (elements.length === 0) {
      this.scrollTracker.unwatch();
      return;
    }

    this.scrollTracker.watch(elements, () => this.onScrollOrLayoutChange());

    this.observed?.disconnect();
    this.observed = new ResizeObserver(() => this.onScrollOrLayoutChange());
    for (const el of elements) this.observed.observe(el);
  }
}
