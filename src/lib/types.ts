export type MeasureMode = 'component' | 'spacing' | 'alignment';

export type DepthFilter = 'direct' | 'all' | 'leaves';

export interface ExtensionSettings {
  mode: MeasureMode;
  snapToIonHost: boolean;
  depthFilter: DepthFilter;
  minSizePx: number;
  active: boolean;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  mode: 'alignment',
  snapToIonHost: false,
  depthFilter: 'direct',
  minSizePx: 2,
  active: false,
};

export interface BoxMetrics {
  element: Element;
  tagName: string;
  rect: DOMRect;
  width: number;
  height: number;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  borderTop: number;
  borderRight: number;
  borderBottom: number;
  borderLeft: number;
}

export interface SpacingResult {
  horizontal: number;
  vertical: number;
  /** True when elements are separated on this axis with a gap > 0 */
  showHorizontal: boolean;
  showVertical: boolean;
  horizontalLine: { x1: number; y1: number; x2: number; y2: number };
  verticalLine: { x1: number; y1: number; x2: number; y2: number };
  labelH: { x: number; y: number };
  labelV: { x: number; y: number };
}
