const ION_TAG_RE = /^ion-/i;
const OVERLAY_HOST_ID = 'ionic-measure-extension-host';

export function isIonHost(el: Element): boolean {
  return ION_TAG_RE.test(el.tagName);
}

export function getOverlayHost(): HTMLElement | null {
  return document.getElementById(OVERLAY_HOST_ID);
}

export function isInsideOverlay(el: Element | null): boolean {
  if (!el) return false;
  const host = getOverlayHost();
  return Boolean(host && (host === el || host.contains(el)));
}

export function findNearestIonHost(el: Element): Element {
  let current: Element | null = el;
  while (current && current !== document.documentElement) {
    if (isIonHost(current)) return current;
    current = current.parentElement;
  }
  return el;
}

function elementsAtPoint(root: Document | ShadowRoot, x: number, y: number): Element[] {
  const doc = root as Document;
  if (typeof doc.elementsFromPoint === 'function') {
    return [...doc.elementsFromPoint(x, y)];
  }
  const el = root.elementFromPoint(x, y);
  return el ? [el] : [];
}

const MAX_SHADOW_DEPTH = 32;

/** Walk open shadow roots at (x,y) without re-entering full hit-test (prevents stack overflow). */
function pierceAllShadows(el: Element, x: number, y: number): Element {
  let current = el;
  const visited = new Set<Element>();

  for (let depth = 0; depth < MAX_SHADOW_DEPTH; depth++) {
    const shadow = current.shadowRoot;
    if (!shadow || visited.has(current)) break;
    visited.add(current);

    const inner = deepestElementInShadow(current, shadow, x, y);
    if (!inner || inner === current) break;
    current = inner;
  }

  return current;
}

/** Smallest element inside one shadow root at (x,y), never the host itself. */
function deepestElementInShadow(
  host: Element,
  shadow: ShadowRoot,
  x: number,
  y: number,
): Element | null {
  let best: Element | null = null;
  let bestArea = Infinity;

  for (const el of elementsAtPoint(shadow, x, y)) {
    if (isInsideOverlay(el) || el === host) continue;
    const root = el.getRootNode();
    if (root !== shadow && root !== document) continue;

    const rect = el.getBoundingClientRect();
    const area = rect.width * rect.height;
    if (area <= 0 || area >= bestArea) continue;
    bestArea = area;
    best = el;
  }

  if (best) return best;

  const fallback = shadow.elementFromPoint(x, y);
  if (
    fallback &&
    fallback !== host &&
    !isInsideOverlay(fallback)
  ) {
    return fallback;
  }

  return null;
}

function elementArea(el: Element): number {
  const rect = el.getBoundingClientRect();
  return rect.width * rect.height;
}

/** Deepest/smallest visible element at viewport coordinates (shadow-piercing). */
function pickSmallestElementAtPoint(
  root: Document | ShadowRoot,
  x: number,
  y: number,
): Element | null {
  let best: Element | null = null;
  let bestArea = Infinity;

  for (const raw of elementsAtPoint(root, x, y)) {
    if (isInsideOverlay(raw)) continue;

    const el = pierceAllShadows(raw, x, y);
    const area = elementArea(el);
    if (area <= 0 || area >= bestArea) continue;
    bestArea = area;
    best = el;
  }

  return best;
}

/** Shadow-piercing hit test — returns the smallest element under the cursor. */
export function deepElementFromPoint(
  root: Document | ShadowRoot,
  x: number,
  y: number,
): Element | null {
  return pickSmallestElementAtPoint(root, x, y);
}

export function isVisible(el: Element): boolean {
  if (!(el instanceof HTMLElement)) {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 || rect.height > 0;
  }
  const style = getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  if (parseFloat(style.opacity) === 0) return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 || rect.height > 0;
}

export async function ensureComponentReady(el: Element): Promise<void> {
  const stencil = el as HTMLElement & {
    componentOnReady?: () => Promise<void>;
  };
  if (typeof stencil.componentOnReady === 'function') {
    try {
      await stencil.componentOnReady();
    } catch {
      /* not a stencil component */
    }
  }
}

export function getChildElements(el: Element): Element[] {
  const out: Element[] = [];
  for (const child of el.children) out.push(child);
  if (el.shadowRoot) {
    for (const child of el.shadowRoot.children) {
      if (child instanceof Element) out.push(child);
    }
  }
  return out;
}

function hasElementChildren(el: Element): boolean {
  if (el.children.length > 0) return true;
  if (el.shadowRoot) {
    for (const child of el.shadowRoot.children) {
      if (child instanceof Element) return true;
    }
  }
  return false;
}

/** Collect visible child elements for component-mode layout spacing. */
export function collectComponentChildren(
  root: Element,
  depthFilter: 'direct' | 'all' | 'leaves',
  minSizePx: number,
): Element[] {
  const minArea = minSizePx * minSizePx;

  const passesSize = (el: Element): boolean => {
    if (!isVisible(el)) return false;
    const rect = el.getBoundingClientRect();
    const area = rect.width * rect.height;
    return area >= minArea;
  };

  if (depthFilter === 'direct') {
    return getChildElements(root).filter(passesSize);
  }

  const out: Element[] = [];
  const walk = (parent: Element): void => {
    for (const child of getChildElements(parent)) {
      if (!passesSize(child)) continue;
      if (depthFilter === 'leaves') {
        if (hasElementChildren(child)) {
          walk(child);
        } else {
          out.push(child);
        }
      } else {
        out.push(child);
        walk(child);
      }
    }
  };

  walk(root);
  return out;
}

export function elementLabel(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : '';
  const cls =
    el.classList.length > 0
      ? '.' + [...el.classList].slice(0, 2).join('.')
      : '';
  return `${tag}${id}${cls}`;
}

/** Rich hover label: exact target + parent + optional ion host + size. */
export function describeElementForHover(el: Element): string {
  const rect = el.getBoundingClientRect();
  const parts = [
    elementLabel(el),
    `${Math.round(rect.width)}×${Math.round(rect.height)}`,
  ];

  const parent = el.parentElement;
  if (
    parent &&
    parent !== document.documentElement &&
    parent !== document.body
  ) {
    parts.push(`in ${elementLabel(parent)}`);
  }

  const ion = findNearestIonHost(el);
  if (isIonHost(ion) && ion !== el) {
    parts.push(`host ${elementLabel(ion)}`);
  }

  return parts.join(' · ');
}
