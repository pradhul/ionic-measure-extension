export interface TypographyInfo {
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  lineHeight: string;
  letterSpacing: string;
  textTransform: string;
  textAlign: string;
  color: string;
}

const TEXT_TAGS = new Set([
  'span',
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'label',
  'a',
  'strong',
  'em',
  'small',
  'button',
  'ion-label',
  'ion-text',
  'ion-note',
  'ion-title',
  'ion-card-title',
  'ion-card-subtitle',
]);

export function isTextElement(el: Element): boolean {
  const tag = el.tagName.toLowerCase();
  if (TEXT_TAGS.has(tag)) return true;

  const text = el.textContent?.trim() ?? '';
  if (!text) return false;

  if (el.children.length === 0) return true;

  // Element with direct text node child
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
      return true;
    }
  }

  return false;
}

export function getTypography(el: Element): TypographyInfo {
  const s = getComputedStyle(el);
  return {
    fontFamily: s.fontFamily,
    fontSize: s.fontSize,
    fontWeight: s.fontWeight,
    lineHeight: s.lineHeight,
    letterSpacing: s.letterSpacing,
    textTransform: s.textTransform,
    textAlign: s.textAlign,
    color: s.color,
  };
}

export function formatTypographyHtml(t: TypographyInfo): string {
  const family = t.fontFamily.split(',')[0]?.replace(/['"]/g, '').trim() ?? t.fontFamily;
  return (
    `<div class="hud-section"><strong>Typography</strong></div>` +
    `<div class="hud-row">font: <span>${t.fontSize} / ${t.lineHeight} "${family}"</span></div>` +
    `<div class="hud-row">weight: <span>${t.fontWeight}</span> · align: <span>${t.textAlign}</span></div>` +
    `<div class="hud-row">letter-spacing: <span>${t.letterSpacing}</span> · transform: <span>${t.textTransform}</span></div>` +
    `<div class="hud-row">color: <span style="color:${t.color}">${t.color}</span></div>`
  );
}
