export const DEFAULT_ALIGNMENT_TOLERANCE = 1;

export interface EdgeGuides {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface GuideVisibility {
  left: boolean;
  right: boolean;
  top: boolean;
  bottom: boolean;
}

export const ALL_GUIDES_VISIBLE: GuideVisibility = {
  left: true,
  right: true,
  top: true,
  bottom: true,
};

export function toggleGuideVisibility(current: GuideVisibility): GuideVisibility {
  const anyVisible = current.left || current.right || current.top || current.bottom;
  if (anyVisible) {
    return { left: false, right: false, top: false, bottom: false };
  }
  return { ...ALL_GUIDES_VISIBLE };
}

export function guidesAreVisible(v: GuideVisibility): boolean {
  return v.left || v.right || v.top || v.bottom;
}

export interface EdgeDelta {
  label: string;
  value: number;
  aligned: boolean;
  /** Guide line position (x for vertical, y for horizontal) */
  guideLine: number;
  axis: 'vertical' | 'horizontal';
}

export interface SnapSegment {
  axis: 'vertical' | 'horizontal';
  guidePos: number;
  spanStart: number;
  spanEnd: number;
}

export interface AlignmentCompareResult {
  guides: EdgeGuides;
  vertical: EdgeDelta[];
  horizontal: EdgeDelta[];
  snaps: SnapSegment[];
}

export interface RectLike {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export function getEdgeGuides(rect: RectLike | DOMRect): EdgeGuides {
  return {
    left: Math.round(rect.left),
    right: Math.round(rect.right),
    top: Math.round(rect.top),
    bottom: Math.round(rect.bottom),
  };
}

export function compareToGuides(
  ref: RectLike | DOMRect,
  hover: RectLike | DOMRect,
  visibility: GuideVisibility = ALL_GUIDES_VISIBLE,
  tolerance = DEFAULT_ALIGNMENT_TOLERANCE,
): AlignmentCompareResult {
  const guides = getEdgeGuides(ref);
  const vertical: EdgeDelta[] = [];
  const horizontal: EdgeDelta[] = [];

  if (visibility.left) {
    vertical.push(
      matchDelta('Hover left ↔ ref left', hover.left, guides.left, tolerance, 'vertical'),
      matchDelta('Hover right ↔ ref left', hover.right, guides.left, tolerance, 'vertical'),
    );
  }
  if (visibility.right) {
    vertical.push(
      matchDelta('Hover left ↔ ref right', hover.left, guides.right, tolerance, 'vertical'),
      matchDelta('Hover right ↔ ref right', hover.right, guides.right, tolerance, 'vertical'),
    );
  }
  if (visibility.top) {
    horizontal.push(
      matchDelta('Hover top ↔ ref top', hover.top, guides.top, tolerance, 'horizontal'),
      matchDelta('Hover bottom ↔ ref top', hover.bottom, guides.top, tolerance, 'horizontal'),
    );
  }
  if (visibility.bottom) {
    horizontal.push(
      matchDelta('Hover top ↔ ref bottom', hover.top, guides.bottom, tolerance, 'horizontal'),
      matchDelta('Hover bottom ↔ ref bottom', hover.bottom, guides.bottom, tolerance, 'horizontal'),
    );
  }

  const snaps = dedupeSnaps(collectSnaps(vertical, horizontal, hover));

  return {
    guides,
    vertical,
    horizontal,
    snaps,
  };
}

function collectSnaps(
  vertical: EdgeDelta[],
  horizontal: EdgeDelta[],
  hover: RectLike | DOMRect,
): SnapSegment[] {
  const snaps: SnapSegment[] = [];
  for (const d of vertical) {
    if (d.aligned) {
      snaps.push({
        axis: 'vertical',
        guidePos: d.guideLine,
        spanStart: hover.top,
        spanEnd: hover.bottom,
      });
    }
  }
  for (const d of horizontal) {
    if (d.aligned) {
      snaps.push({
        axis: 'horizontal',
        guidePos: d.guideLine,
        spanStart: hover.left,
        spanEnd: hover.right,
      });
    }
  }
  return snaps;
}

function dedupeSnaps(snaps: SnapSegment[]): SnapSegment[] {
  const map = new Map<string, SnapSegment>();
  for (const s of snaps) {
    const key = `${s.axis}:${s.guidePos}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...s });
    } else {
      existing.spanStart = Math.min(existing.spanStart, s.spanStart);
      existing.spanEnd = Math.max(existing.spanEnd, s.spanEnd);
    }
  }
  return [...map.values()];
}

function matchDelta(
  label: string,
  hoverCoord: number,
  guideCoord: number,
  tolerance: number,
  axis: 'vertical' | 'horizontal',
): EdgeDelta {
  const value = Math.round(hoverCoord - guideCoord);
  return {
    label,
    value,
    aligned: Math.abs(value) <= tolerance,
    guideLine: guideCoord,
    axis,
  };
}

/** Human-readable labels for aligned edge pairs only. */
export function alignedMatchLabels(compare: AlignmentCompareResult): string[] {
  const labels: Record<string, string> = {
    'Hover left ↔ ref left': 'Left edges',
    'Hover right ↔ ref left': 'Right ↔ ref left',
    'Hover left ↔ ref right': 'Left ↔ ref right',
    'Hover right ↔ ref right': 'Right edges',
    'Hover top ↔ ref top': 'Top edges',
    'Hover bottom ↔ ref top': 'Bottom ↔ ref top',
    'Hover top ↔ ref bottom': 'Top ↔ ref bottom',
    'Hover bottom ↔ ref bottom': 'Bottom edges',
  };
  const out: string[] = [];
  for (const d of [...compare.vertical, ...compare.horizontal]) {
    if (d.aligned) out.push(labels[d.label] ?? d.label);
  }
  return out;
}
