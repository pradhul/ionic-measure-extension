import type { BoxMetrics } from './types';
import type { SpacingResult } from './types';
import { computeSpacing } from './spacing';
import { measureElement } from './measure';

export interface LayoutSpacing {
  kind: 'sibling' | 'parent-child';
  from: string;
  to: string;
  spacing: SpacingResult;
}

export function contentBox(m: BoxMetrics): {
  left: number;
  top: number;
  right: number;
  bottom: number;
} {
  return {
    left: m.rect.left + m.borderLeft + m.paddingLeft,
    top: m.rect.top + m.borderTop + m.paddingTop,
    right: m.rect.right - m.borderRight - m.paddingRight,
    bottom: m.rect.bottom - m.borderBottom - m.paddingBottom,
  };
}

export function marginBox(m: BoxMetrics): {
  left: number;
  top: number;
  right: number;
  bottom: number;
} {
  return {
    left: m.rect.left - m.marginLeft,
    top: m.rect.top - m.marginTop,
    right: m.rect.right + m.marginRight,
    bottom: m.rect.bottom + m.marginBottom,
  };
}

function rectFromBox(box: {
  left: number;
  top: number;
  right: number;
  bottom: number;
}): DOMRect {
  return {
    left: box.left,
    top: box.top,
    right: box.right,
    bottom: box.bottom,
    width: box.right - box.left,
    height: box.bottom - box.top,
    x: box.left,
    y: box.top,
    toJSON: () => ({}),
  } as DOMRect;
}

/** Gaps from parent content box to each child's margin box (only positive axes). */
export function computeParentChildSpacings(
  parent: BoxMetrics,
  children: BoxMetrics[],
): LayoutSpacing[] {
  const pContent = contentBox(parent);
  const out: LayoutSpacing[] = [];

  for (const child of children) {
    const cMargin = marginBox(child);
    const spacing = computeSpacing(rectFromBox(pContent), rectFromBox(cMargin));
    if (!spacing.showHorizontal && !spacing.showVertical) continue;
    out.push({
      kind: 'parent-child',
      from: parent.tagName,
      to: child.tagName,
      spacing,
    });
  }
  return out;
}

/** Sort by visual position then measure gaps between layout-adjacent siblings. */
export function computeSiblingSpacings(children: BoxMetrics[]): LayoutSpacing[] {
  if (children.length < 2) return [];

  const sorted = [...children].sort((a, b) => {
    const dy = a.rect.top - b.rect.top;
    if (Math.abs(dy) > 4) return dy;
    return a.rect.left - b.rect.left;
  });

  const out: LayoutSpacing[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    const spacing = computeSpacing(a.rect, b.rect);
    if (!spacing.showHorizontal && !spacing.showVertical) continue;
    out.push({
      kind: 'sibling',
      from: a.tagName,
      to: b.tagName,
      spacing,
    });
  }
  return out;
}

export function buildComponentLayoutSpacings(
  root: Element,
  childElements: Element[],
): { rootMetrics: BoxMetrics; childMetrics: BoxMetrics[]; spacings: LayoutSpacing[] } {
  const rootMetrics = measureElement(root);
  const childMetrics = childElements.map((el) => measureElement(el));
  const parentChild = computeParentChildSpacings(rootMetrics, childMetrics);
  const sibling = computeSiblingSpacings(childMetrics);
  return {
    rootMetrics,
    childMetrics,
    spacings: [...parentChild, ...sibling],
  };
}
