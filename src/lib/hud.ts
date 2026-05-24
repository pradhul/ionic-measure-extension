const HUD_STORAGE_KEY = 'hudPosition';

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
    handle.textContent = 'Ionic Measure';
    handle.title = 'Drag to move';
    hud.prepend(handle);
  }

  const body = document.createElement('div');
  body.className = 'hud-body';
  while (handle.nextSibling) {
    body.appendChild(handle.nextSibling);
  }
  hud.appendChild(body);

  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  void loadHudPosition().then((pos) => {
    if (pos) {
      hud.style.left = `${pos.x}px`;
      hud.style.top = `${pos.y}px`;
    }
  });

  const onMove = (e: MouseEvent): void => {
    if (!dragging) return;
    e.preventDefault();
    e.stopPropagation();
    const x = Math.max(0, e.clientX - offsetX);
    const y = Math.max(0, e.clientY - offsetY);
    hud.style.left = `${x}px`;
    hud.style.top = `${y}px`;
  };

  const onUp = (e: MouseEvent): void => {
    if (!dragging) return;
    dragging = false;
    onDragEnd?.();
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('mouseup', onUp, true);
    const x = parseFloat(hud.style.left) || 12;
    const y = parseFloat(hud.style.top) || 12;
    void saveHudPosition({ x, y });
    e.stopPropagation();
  };

  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragging = true;
    onDragStart?.();
    const rect = hud.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('mouseup', onUp, true);
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
