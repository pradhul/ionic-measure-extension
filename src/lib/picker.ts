import {
  deepElementFromPoint,
  describeElementForHover,
  elementLabel,
  ensureComponentReady,
  findNearestIonHost,
  isIonHost,
} from './dom';
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
  alignedMatchLabels,
  compareToGuides,
  getEdgeGuides,
  guidesAreVisible,
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
    this.overlay.setHud(
      `<span class="hud-tag">Active</span>` +
        `<div class="hud-row">Hover any element · click to inspect</div>` +
        `<div class="hud-row">Component = CSS on that element</div>` +
        `<div class="hud-row">Spacing = gap vs another element</div>` +
        `<div class="hud-row">Alignment = edge lines from selection (click ref to toggle)</div>`,
    );
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
    this.overlay.setHud(
      `<span class="hud-tag">Ready</span>` +
        `<div class="hud-row">Selection cleared — hover & click any element</div>`,
    );
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

  private onMouseMove(e: MouseEvent): void {
    if (this.overlay.isHudDragging()) return;

    const target = this.pickAt(e.clientX, e.clientY);
    if (!target) {
      this.overlay.hideHover();
      return;
    }

    const rect = target.getBoundingClientRect();
    const label = elementLabel(target);
    const meta = describeElementForHover(target).replace(`${label} · `, '');

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
      `Dashed orange = margin · green = padding · blue = border box</div>`;

    return html;
  }

  private buildAlignmentHudHtml(
    ref: Element,
    visibility: typeof this.alignmentGuideVisibility,
    hover?: Element,
    compare?: ReturnType<typeof compareToGuides>,
  ): string {
    const guidesOn = guidesAreVisible(visibility);
    let html =
      `<span class="hud-tag">Alignment</span>` +
      `<div class="hud-row">Reference: <span>${elementLabel(ref)}</span></div>`;

    if (!guidesOn) {
      html += `<div class="hud-row">Guides hidden — click reference to show</div>`;
    }

    if (hover && compare) {
      html += `<div class="hud-row">Hover: <span>${elementLabel(hover)}</span></div>`;
      if (!guidesOn) {
        html += `<div class="hud-row">Show guides to check alignment</div>`;
      } else {
        const matches = alignedMatchLabels(compare);
        if (matches.length > 0) {
          html += `<div class="hud-row">Aligned: <span>${matches.join(' · ')}</span></div>`;
        } else {
          html += `<div class="hud-row">Not aligned</div>`;
        }
      }
    } else if (guidesOn) {
      html += `<div class="hud-row">Hover elements to check alignment</div>`;
    }

    html += `<div class="hud-row" style="opacity:0.7;margin-top:6px">Click reference to toggle guides</div>`;

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
        this.buildAlignmentHudHtml(ref, visibility, hover, compare),
        hoverRect,
        compare,
      );
      return;
    }

    this.overlay.renderAlignment(
      refRect,
      guides,
      visibility,
      this.buildAlignmentHudHtml(ref, visibility),
    );
  }

  private async renderComponent(): Promise<void> {
    if (!this.componentRoot) return;
    await ensureComponentReady(this.componentRoot);

    const el = this.componentRoot;
    const metrics = measureElement(el);
    const hudHtml = this.buildComponentHudHtml(el, metrics);

    this.overlay.renderComponent(metrics, hudHtml);
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
