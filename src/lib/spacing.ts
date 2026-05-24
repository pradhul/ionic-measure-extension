import type { SpacingResult } from './types';

export interface RectLike {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Edge-to-edge gaps; only shows axes where elements are separated (positive gap). */
export function computeSpacing(a: DOMRect | RectLike, b: DOMRect | RectLike): SpacingResult {
  const horizontal = gapBetweenIntervals(a.left, a.right, b.left, b.right);
  const vertical = gapBetweenIntervals(a.top, a.bottom, b.top, b.bottom);

  const showHorizontal = isSeparatedHorizontally(a, b) && horizontal > 0;
  const showVertical = isSeparatedVertically(a, b) && vertical > 0;

  const hLine = horizontalConnector(a, b, horizontal);
  const vLine = verticalConnector(a, b, vertical);

  return {
    horizontal,
    vertical,
    showHorizontal,
    showVertical,
    horizontalLine: hLine,
    verticalLine: vLine,
    labelH: {
      x: (hLine.x1 + hLine.x2) / 2,
      y: hLine.y1 - 8,
    },
    labelV: {
      x: vLine.x1 + 8,
      y: (vLine.y1 + vLine.y2) / 2,
    },
  };
}

export function isSeparatedHorizontally(a: RectLike, b: RectLike): boolean {
  return a.right <= b.left || b.right <= a.left;
}

export function isSeparatedVertically(a: RectLike, b: RectLike): boolean {
  return a.bottom <= b.top || b.bottom <= a.top;
}

function gapBetweenIntervals(
  a0: number,
  a1: number,
  b0: number,
  b1: number,
): number {
  if (a1 <= b0) return Math.round(b0 - a1);
  if (b1 <= a0) return Math.round(a0 - b1);
  return -Math.round(Math.min(a1 - b0, b1 - a0));
}

function horizontalConnector(
  a: RectLike,
  b: RectLike,
  gap: number,
): { x1: number; y1: number; x2: number; y2: number } {
  const y = (Math.min(a.bottom, b.bottom) + Math.max(a.top, b.top)) / 2;
  if (a.right <= b.left) {
    return { x1: a.right, y1: y, x2: b.left, y2: y };
  }
  if (b.right <= a.left) {
    return { x1: b.right, y1: y, x2: a.left, y2: y };
  }
  const mid = (a.left + a.right + b.left + b.right) / 4;
  return { x1: mid, y1: y, x2: mid + Math.max(gap, 4), y2: y };
}

function verticalConnector(
  a: RectLike,
  b: RectLike,
  gap: number,
): { x1: number; y1: number; x2: number; y2: number } {
  const x = (Math.min(a.right, b.right) + Math.max(a.left, b.left)) / 2;
  if (a.bottom <= b.top) {
    return { x1: x, y1: a.bottom, x2: x, y2: b.top };
  }
  if (b.bottom <= a.top) {
    return { x1: x, y1: b.bottom, x2: x, y2: a.top };
  }
  const mid = (a.top + a.bottom + b.top + b.bottom) / 4;
  return { x1: x, y1: mid, x2: x, y2: mid + Math.max(gap, 4) };
}
