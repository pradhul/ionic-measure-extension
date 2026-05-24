/**
 * Unit tests for spacing math (run with: npm run test)
 */
import { computeSpacing } from './spacing.ts';

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

// Side by side: only horizontal gap
{
  const a = { left: 0, top: 0, right: 100, bottom: 50, width: 100, height: 50 } as DOMRect;
  const b = { left: 116, top: 0, right: 200, bottom: 50, width: 84, height: 50 } as DOMRect;
  const s = computeSpacing(a, b);
  assert(s.horizontal === 16, `expected H=16, got ${s.horizontal}`);
  assert(s.showHorizontal === true, 'should show horizontal');
  assert(s.showVertical === false, 'should not show vertical when aligned in a row');
}

// Stacked: only vertical gap
{
  const a = { left: 0, top: 0, right: 100, bottom: 40, width: 100, height: 40 } as DOMRect;
  const b = { left: 0, top: 48, right: 100, bottom: 88, width: 100, height: 40 } as DOMRect;
  const s = computeSpacing(a, b);
  assert(s.vertical === 8, `expected V=8, got ${s.vertical}`);
  assert(s.showVertical === true, 'should show vertical');
  assert(s.showHorizontal === false, 'should not show horizontal when aligned in a column');
}

// Overlapping: no positive gaps shown
{
  const a = { left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 } as DOMRect;
  const b = { left: 20, top: 20, right: 80, bottom: 80, width: 60, height: 60 } as DOMRect;
  const s = computeSpacing(a, b);
  assert(s.showHorizontal === false, 'nested overlap hides horizontal');
  assert(s.showVertical === false, 'nested overlap hides vertical');
}

console.log('spacing.test.ts: all passed');
