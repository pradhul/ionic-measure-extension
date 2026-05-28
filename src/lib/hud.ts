const HUD_STORAGE_KEY = 'hudPosition';
const HUD_COLLAPSED_STORAGE_KEY = 'hudCollapsed';

export interface HudPosition {
  x: number;
  y: number;
}

export async function loadHudPosition(): Promise<HudPosition | null> {
  const stored = await chrome.storage.local.get([HUD_STORAGE_KEY]);
  const pos = stored[HUD_STORAGE_KEY] as HudPosition | undefined;
  if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) return pos;
  return null;
}

export async function saveHudPosition(pos: HudPosition): Promise<void> {
  await chrome.storage.local.set({ [HUD_STORAGE_KEY]: pos });
}

export async function loadHudCollapsed(): Promise<boolean> {
  const stored = await chrome.storage.local.get([HUD_COLLAPSED_STORAGE_KEY]);
  const value = stored[HUD_COLLAPSED_STORAGE_KEY];
  return typeof value === 'boolean' ? value : true;
}

export async function saveHudCollapsed(collapsed: boolean): Promise<void> {
  await chrome.storage.local.set({ [HUD_COLLAPSED_STORAGE_KEY]: collapsed });
}

/** Makes the HUD draggable via its header handle. */
export function attachDraggableHud(
  hud: HTMLElement,
  onDragStart?: () => void,
  onDragEnd?: () => void,
): void {
  hud.classList.add('hud-draggable');

  let handle = hud.querySelector('.hud-handle') as HTMLElement | null;
  if (!handle) {
    handle = document.createElement('div');
    handle.className = 'hud-handle';
    handle.title = 'Drag to move';
    handle.innerHTML =
      '<span class="hud-title">Ionic Measure</span><button type="button" class="hud-collapse-toggle" aria-label="Collapse HUD" aria-expanded="true">−</button>';
    hud.prepend(handle);
  }

  const body = document.createElement('div');
  body.className = 'hud-body';
  while (handle.nextSibling) {
    body.appendChild(handle.nextSibling);
  }
  hud.appendChild(body);

  let dragging = false;
  let pointerId: number | null = null;
  let offsetX = 0;
  let offsetY = 0;
  let collapsed = false;

  const toggleEl = handle.querySelector('.hud-collapse-toggle') as HTMLButtonElement | null;

  const applyCollapsed = (nextCollapsed: boolean): void => {
    collapsed = nextCollapsed;
    hud.classList.toggle('is-collapsed', collapsed);
    if (toggleEl) {
      toggleEl.textContent = collapsed ? '+' : '−';
      toggleEl.setAttribute('aria-label', collapsed ? 'Expand HUD' : 'Collapse HUD');
      toggleEl.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    }
  };

  void loadHudPosition().then((pos) => {
    if (pos) {
      hud.style.left = `${pos.x}px`;
      hud.style.top = `${pos.y}px`;
    }
  });
  void loadHudCollapsed().then((isCollapsed) => applyCollapsed(isCollapsed));

  const onMove = (e: PointerEvent): void => {
    if (!dragging) return;
    e.preventDefault();
    e.stopPropagation();
    const x = Math.max(0, e.clientX - offsetX);
    const y = Math.max(0, e.clientY - offsetY);
    hud.style.left = `${x}px`;
    hud.style.top = `${y}px`;
  };

  const onUp = (e: PointerEvent): void => {
    if (!dragging) return;
    dragging = false;
    if (pointerId != null && handle.hasPointerCapture(pointerId)) {
      handle.releasePointerCapture(pointerId);
    }
    pointerId = null;
    onDragEnd?.();
    document.removeEventListener('pointermove', onMove, true);
    document.removeEventListener('pointerup', onUp, true);
    document.removeEventListener('pointercancel', onUp, true);
    const x = parseFloat(hud.style.left) || 12;
    const y = parseFloat(hud.style.top) || 12;
    void saveHudPosition({ x, y });
    e.stopPropagation();
  };

  toggleEl?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const nextCollapsed = !collapsed;
    applyCollapsed(nextCollapsed);
    void saveHudCollapsed(nextCollapsed);
  });

  handle.addEventListener('pointerdown', (e) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest('.hud-collapse-toggle')) return;
    e.preventDefault();
    e.stopPropagation();
    dragging = true;
    pointerId = e.pointerId;
    onDragStart?.();
    const rect = hud.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    handle?.setPointerCapture(e.pointerId);
    document.addEventListener('pointermove', onMove, true);
    document.addEventListener('pointerup', onUp, true);
    document.addEventListener('pointercancel', onUp, true);
  });

  handle.addEventListener('lostpointercapture', () => {
    if (dragging && pointerId != null) {
      dragging = false;
      pointerId = null;
      onDragEnd?.();
      document.removeEventListener('pointermove', onMove, true);
      document.removeEventListener('pointerup', onUp, true);
      document.removeEventListener('pointercancel', onUp, true);
    }
  });
}

/** Set HUD HTML into the body region (keeps drag handle). */
export function setHudContent(hud: HTMLElement, html: string): void {
  let body = hud.querySelector('.hud-body') as HTMLElement | null;
  if (!body) {
    body = document.createElement('div');
    body.className = 'hud-body';
    hud.appendChild(body);
  }
  body.innerHTML = html;
}
