import type { BoxMetrics } from './types';
import { elementLabel } from './dom';

function parsePx(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

export function measureElement(el: Element): BoxMetrics {
  const rect = el.getBoundingClientRect();
  const style = getComputedStyle(el);

  return {
    element: el,
    tagName: elementLabel(el),
    rect,
    width: Math.round(rect.width),
    height: Math.round(rect.height),
    marginTop: parsePx(style.marginTop),
    marginRight: parsePx(style.marginRight),
    marginBottom: parsePx(style.marginBottom),
    marginLeft: parsePx(style.marginLeft),
    paddingTop: parsePx(style.paddingTop),
    paddingRight: parsePx(style.paddingRight),
    paddingBottom: parsePx(style.paddingBottom),
    paddingLeft: parsePx(style.paddingLeft),
    borderTop: parsePx(style.borderTopWidth),
    borderRight: parsePx(style.borderRightWidth),
    borderBottom: parsePx(style.borderBottomWidth),
    borderLeft: parsePx(style.borderLeftWidth),
  };
}
