/**
 * Unit tests for alignment math (run with: npm run test)
 */
import {
  alignedMatchLabels,
  compareToGuides,
  getEdgeGuides,
  ALL_GUIDES_VISIBLE,
  DEFAULT_ALIGNMENT_TOLERANCE,
} from './alignment.ts';

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function rect(
  left: number,
  top: number,
  width: number,
  height: number,
): DOMRect {
  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
  } as DOMRect;
}

// Edge guides from bounding box
{
  const g = getEdgeGuides(rect(100, 50, 200, 80));
  assert(g.left === 100, `expected left=100, got ${g.left}`);
  assert(g.right === 300, `expected right=300, got ${g.right}`);
  assert(g.top === 50, `expected top=50, got ${g.top}`);
  assert(g.bottom === 130, `expected bottom=130, got ${g.bottom}`);
}

// Left edges aligned
{
  const ref = rect(0, 0, 100, 40);
  const hover = rect(0, 60, 80, 30);
  const r = compareToGuides(ref, hover);
  const match = r.vertical.find((d) => d.label === 'Hover left ↔ ref left')!;
  assert(match.aligned, 'left edges should align');
  assert(r.snaps.some((s) => s.axis === 'vertical' && s.guidePos === 0), 'snap on ref left');
  assert(alignedMatchLabels(r).includes('Left edges'), 'lists left alignment');
}

// Top edges aligned
{
  const ref = rect(0, 0, 100, 40);
  const hover = rect(120, 0, 50, 40);
  const r = compareToGuides(ref, hover);
  const match = r.horizontal.find((d) => d.label === 'Hover top ↔ ref top')!;
  assert(match.aligned, 'top edges should align');
}

// No aligned labels when edges do not match
{
  const ref = rect(0, 0, 100, 40);
  const hover = rect(64, 60, 50, 40);
  const r = compareToGuides(ref, hover, ALL_GUIDES_VISIBLE, DEFAULT_ALIGNMENT_TOLERANCE);
  assert(alignedMatchLabels(r).length === 0, 'should list no alignments');
}

// Hidden guides excluded from compare
{
  const ref = rect(0, 0, 100, 40);
  const hover = rect(0, 60, 80, 30);
  const r = compareToGuides(ref, hover, {
    left: false,
    right: false,
    top: true,
    bottom: true,
  });
  assert(r.vertical.length === 0, 'no vertical comparisons when L/R guides hidden');
  assert(r.horizontal.length > 0, 'horizontal comparisons remain');
}

console.log('alignment.test.ts: all passed');
