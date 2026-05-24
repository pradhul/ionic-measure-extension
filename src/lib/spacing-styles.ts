import type { BoxMetrics } from './types';

export interface SpacingStyles {
  margin: string;
  padding: string;
  border: string;
  gap: string;
  rowGap: string;
  columnGap: string;
  borderRadius: string;
  boxSizing: string;
  width: string;
  height: string;
  minWidth: string;
  minHeight: string;
  maxWidth: string;
  maxHeight: string;
}

function shorthand(
  top: string,
  right: string,
  bottom: string,
  left: string,
): string {
  if (top === right && right === bottom && bottom === left) return top;
  if (top === bottom && left === right) return `${top} ${right}`;
  return `${top} ${right} ${bottom} ${left}`;
}

function nonZero(val: string): boolean {
  const n = parseFloat(val);
  return Number.isFinite(n) ? n !== 0 : val !== '0' && val !== '0px';
}

export function getSpacingStyles(el: Element): SpacingStyles {
  const s = getComputedStyle(el);
  return {
    margin: shorthand(s.marginTop, s.marginRight, s.marginBottom, s.marginLeft),
    padding: shorthand(s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft),
    border: shorthand(
      s.borderTopWidth,
      s.borderRightWidth,
      s.borderBottomWidth,
      s.borderLeftWidth,
    ),
    gap: s.gap,
    rowGap: s.rowGap,
    columnGap: s.columnGap,
    borderRadius: s.borderRadius,
    boxSizing: s.boxSizing,
    width: s.width,
    height: s.height,
    minWidth: s.minWidth,
    minHeight: s.minHeight,
    maxWidth: s.maxWidth,
    maxHeight: s.maxHeight,
  };
}

export function formatSpacingStylesHtml(
  styles: SpacingStyles,
  metrics: BoxMetrics,
): string {
  const rows: string[] = [];

  const add = (label: string, value: string, always = false) => {
    if (
      always ||
      (value && value !== '0px' && value !== 'normal' && value !== 'none')
    ) {
      rows.push(`<div class="hud-row">${label}: <span>${value}</span></div>`);
    }
  };

  rows.push(
    `<div class="hud-row">size: <span>${metrics.width}×${metrics.height}px</span> (${styles.boxSizing})</div>`,
  );
  add('margin', styles.margin, true);
  add('padding', styles.padding, true);
  add('border', styles.border);
  if (nonZero(styles.gap) && styles.gap !== styles.rowGap) add('gap', styles.gap);
  if (nonZero(styles.rowGap)) add('row-gap', styles.rowGap);
  if (nonZero(styles.columnGap)) add('column-gap', styles.columnGap);
  if (styles.borderRadius !== '0px') add('radius', styles.borderRadius);
  if (styles.minHeight !== '0px' && styles.minHeight !== 'auto') {
    add('min-height', styles.minHeight);
  }

  return `<div class="hud-section"><strong>Spacing (CSS)</strong></div>${rows.join('')}`;
}
