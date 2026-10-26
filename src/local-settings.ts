import { validateObsAddress } from './audio';

/** Remember nonsecret settings independently for each local entry page. */
export function rememberLocalSettings(): string {
  const key = `voxflare-local:${window.location.pathname}`;
  const ids = ['mode', 'avatar-background', 'obs-address', 'obs-source', 'obs-sensitivity',
    'motion-speed', 'mode-transition', 'speech-response', 'interior-breathing', 'interior-rotation'];
  const controls = ids.map(id => document.getElementById(id) as HTMLInputElement | HTMLSelectElement);
  let saved: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) saved = parsed as Record<string, unknown>;
  } catch { /* Browser storage is optional; retain the entry page's defaults. */ }
  let source = typeof saved['obs-source'] === 'string' ? saved['obs-source'] : '';

  for (const control of controls) {
    const value = saved[control.id];
    if (typeof value !== 'string' || control.id === 'obs-source') continue;
    if (control.id === 'avatar-background') {
      // Explicit URL options still take precedence over remembered preferences.
      if (!new URLSearchParams(window.location.search).has('background') && ['true', 'false'].includes(value)) {
        (control as HTMLInputElement).checked = value === 'true';
      }
    } else if (control.id === 'obs-address') {
      try { control.value = validateObsAddress(value); } catch { /* Keep the default address. */ }
    } else if (control instanceof HTMLSelectElement) {
      if (Array.from(control.options).some(option => option.value === value)) control.value = value;
    } else if (value.trim() !== '' && Number.isFinite(Number(value))) {
      // Range inputs clamp saved numeric values to their current limits.
      control.value = value;
    }
  }

  function save(): void {
    const values: Record<string, string> = {};
    for (const control of controls) {
      if (control.id === 'obs-address') {
        try { values[control.id] = validateObsAddress(control.value); } catch { /* Do not persist invalid URLs or embedded secrets. */ }
      } else {
        values[control.id] = control.type === 'checkbox' ? String((control as HTMLInputElement).checked) :
          control.id === 'obs-source' ? source : control.value;
      }
    }
    try { localStorage.setItem(key, JSON.stringify(values)); } catch { /* Continue with in-memory settings if storage is unavailable. */ }
  }
  for (const control of controls) {
    control.addEventListener('change', () => {
      if (control.id === 'obs-source') source = control.value;
      save();
    });
  }
  return source;
}
