/** Find scrollable ancestors including Ionic shadow scroll containers. */
export function getScrollableAncestors(el: Element): EventTarget[] {
  const targets: EventTarget[] = [window];
  const seen = new Set<EventTarget>();

  let node: Element | null = el;
  while (node) {
    if (node.shadowRoot) {
      const innerScroll = node.shadowRoot.querySelector(
        '[part="scroll"], .inner-scroll, .scroll-content, main',
      );
      if (innerScroll instanceof Element && !seen.has(innerScroll)) {
        seen.add(innerScroll);
        targets.push(innerScroll);
      }
    }

    if (node instanceof HTMLElement) {
      const style = getComputedStyle(node);
      const overflow = `${style.overflow} ${style.overflowX} ${style.overflowY}`;
      if (/(auto|scroll|overlay)/.test(overflow)) {
        if (!seen.has(node)) {
          seen.add(node);
          targets.push(node);
        }
      }
    }

    node = node.parentElement;
  }

  return targets;
}

export function isElementInViewport(el: Element): boolean {
  if (!el.isConnected) return false;
  const r = el.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return r.bottom > 0 && r.right > 0 && r.top < vh && r.left < vw;
}

/** Attach scroll listeners on all scroll parents; throttled via rAF. */
export class ScrollTracker {
  private bindings = new Map<EventTarget, () => void>();
  private rafId = 0;

  watch(elements: Element[], onScroll: () => void): void {
    this.unwatch();

    const handler = (): void => {
      cancelAnimationFrame(this.rafId);
      this.rafId = requestAnimationFrame(() => onScroll());
    };

    const seen = new Set<EventTarget>();
    for (const el of elements) {
      for (const target of getScrollableAncestors(el)) {
        if (seen.has(target)) continue;
        seen.add(target);
        target.addEventListener('scroll', handler, {
          passive: true,
          capture: true,
        });
        this.bindings.set(target, handler);
      }
    }
  }

  unwatch(): void {
    for (const [target, handler] of this.bindings) {
      target.removeEventListener('scroll', handler, true);
    }
    this.bindings.clear();
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }
}
