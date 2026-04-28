import type { GeoValidator, RegionGroup, CountryGroup } from './types';

const MAX_DROPDOWN_ROWS = 20;

const styles = {
  wrapper: {
    position: 'relative',
    transform: 'translate(-50%, -100%)',
    pointerEvents: 'auto',
    cursor: 'default',
    outline: 'none',
  },
  badge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '3px 8px 3px 5px',
    background: 'rgba(15, 5, 30, 0.78)',
    border: '1px solid rgba(223, 142, 255, 0.5)',
    borderRadius: '999px',
    backdropFilter: 'blur(6px)',
    boxShadow:
      '0 0 10px rgba(179, 37, 214, 0.3), inset 0 0 6px rgba(223,142,255,0.05)',
    whiteSpace: 'nowrap',
    transition: 'border-color 160ms ease, box-shadow 160ms ease',
  },
  labelText: {
    fontFamily: "'SF Pro Display', 'Inter', system-ui, sans-serif",
    fontSize: '9px',
    fontWeight: '600',
    letterSpacing: '0.07em',
    textTransform: 'uppercase',
    color: '#e8c8ff',
    textShadow: '0 0 6px rgba(179,37,214,0.8)',
  },
  countPill: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '16px',
    height: '14px',
    padding: '0 4px',
    borderRadius: '999px',
    background: 'rgba(179, 37, 214, 0.55)',
    border: '1px solid rgba(223, 142, 255, 0.45)',
    color: '#fff',
    fontFamily: "'SF Pro Display', 'Inter', system-ui, sans-serif",
    fontSize: '9px',
    fontWeight: '700',
    lineHeight: '1',
  },
  dropdown: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    left: '50%',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    padding: '8px',
    minWidth: '200px',
    maxWidth: '260px',
    background: 'rgba(15, 5, 30, 0.92)',
    border: '1px solid rgba(223, 142, 255, 0.4)',
    borderRadius: '12px',
    backdropFilter: 'blur(10px)',
    boxShadow: '0 4px 20px rgba(0,0,0,0.5), 0 0 14px rgba(179, 37, 214, 0.4)',
    maxHeight: '240px',
    overflowY: 'auto',
  },
  dropdownHeader: {
    fontFamily: "'SF Pro Display', system-ui, sans-serif",
    fontSize: '9px',
    fontWeight: '600',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: '#b58fd4',
    padding: '2px 4px 6px',
    borderBottom: '1px solid rgba(223,142,255,0.2)',
    marginBottom: '2px',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '4px 6px',
    borderRadius: '8px',
    background: 'rgba(223, 142, 255, 0.06)',
    border: '1px solid rgba(223, 142, 255, 0.12)',
  },
  avatar: {
    position: 'relative',
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #6b1f8f, #b325d6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: '0',
    overflow: 'hidden',
    border: '1px solid rgba(223, 142, 255, 0.4)',
  },
  avatarInitial: {
    color: '#fff',
    fontFamily: "'SF Pro Display', system-ui, sans-serif",
    fontSize: '11px',
    fontWeight: '700',
  },
  avatarImg: {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    opacity: '0',
    transition: 'opacity 200ms ease',
  },
  textWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1px',
    minWidth: '0',
    flex: '1',
  },
  rowName: {
    fontFamily: "'SF Pro Display', system-ui, sans-serif",
    fontSize: '11px',
    fontWeight: '600',
    color: '#f0d8ff',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    textShadow: '0 0 4px rgba(179,37,214,0.5)',
  },
  rowMeta: {
    fontFamily: "'SF Pro Display', system-ui, sans-serif",
    fontSize: '9px',
    fontWeight: '400',
    color: '#a87fc4',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  moreRow: {
    fontFamily: "'SF Pro Display', system-ui, sans-serif",
    fontSize: '9px',
    fontWeight: '500',
    color: '#a561c9',
    padding: '4px 6px',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  dotWrap: {
    position: 'relative',
    width: '6px',
    height: '6px',
    flexShrink: '0',
  },
  dotPulse: {
    position: 'absolute',
    inset: '-3px',
    borderRadius: '50%',
    background: 'rgba(179, 37, 214, 0.35)',
  },
  dotCore: {
    position: 'absolute',
    inset: '0',
    borderRadius: '50%',
    background: '#df8eff',
    boxShadow: '0 0 5px #b325d6',
  },
} satisfies Record<string, Partial<CSSStyleDeclaration>>;

function applyStyle(
  el: HTMLElement,
  style: Partial<CSSStyleDeclaration>
): void {
  Object.assign(el.style, style);
}

/* ── Pulsing dot ── */
function createPulsingDot(): HTMLElement {
  const wrap = document.createElement('div');
  applyStyle(wrap, styles.dotWrap);

  const pulse = document.createElement('span');
  pulse.className = 'globe-label-pulse';
  applyStyle(pulse, styles.dotPulse);

  const core = document.createElement('span');
  applyStyle(core, styles.dotCore);

  wrap.appendChild(pulse);
  wrap.appendChild(core);
  return wrap;
}

/* ── Validator row (with avatar fallback) ── */
function createValidatorRow(
  v: GeoValidator,
  showCountry: boolean
): HTMLElement {
  const row = document.createElement('div');
  applyStyle(row, styles.row);

  // Avatar — initial fallback always renders; image overlays on load.
  const avatar = document.createElement('div');
  applyStyle(avatar, styles.avatar);

  const initial = document.createElement('span');
  initial.textContent = (v.name?.[0] ?? '?').toUpperCase();
  applyStyle(initial, styles.avatarInitial);
  avatar.appendChild(initial);

  if (v.imageUrl) {
    const img = document.createElement('img');
    img.src = v.imageUrl;
    img.alt = '';
    img.loading = 'lazy';
    applyStyle(img, styles.avatarImg);
    img.onload = () => {
      img.style.opacity = '1';
    };
    img.onerror = () => {
      img.remove(); // initial fallback stays visible
    };
    avatar.appendChild(img);
  }

  // Text
  const textWrap = document.createElement('div');
  applyStyle(textWrap, styles.textWrap);

  const name = document.createElement('div');
  name.textContent = v.name;
  applyStyle(name, styles.rowName);
  textWrap.appendChild(name);

  const metaText = showCountry
    ? [v.city, v.country].filter(Boolean).join(', ')
    : v.city || '';
  if (metaText) {
    const meta = document.createElement('div');
    meta.textContent = metaText;
    applyStyle(meta, styles.rowMeta);
    textWrap.appendChild(meta);
  }

  row.appendChild(avatar);
  row.appendChild(textWrap);
  return row;
}

/* ── Shared wrapper + badge construction ── */
function createLabelShell(
  text: string,
  count: number | null
): { wrapper: HTMLElement; dropdown: HTMLElement } {
  const wrapper = document.createElement('div');
  wrapper.className = 'globe-label globe-hover-label';
  wrapper.tabIndex = 0;
  applyStyle(wrapper, styles.wrapper);

  const badge = document.createElement('div');
  badge.className = 'globe-hover-badge';
  applyStyle(badge, styles.badge);

  const label = document.createElement('span');
  label.textContent = text;
  applyStyle(label, styles.labelText);

  badge.appendChild(createPulsingDot());
  badge.appendChild(label);

  if (count !== null) {
    const countEl = document.createElement('span');
    countEl.textContent = String(count);
    applyStyle(countEl, styles.countPill);
    badge.appendChild(countEl);
  }

  const dropdown = document.createElement('div');
  dropdown.className = 'globe-hover-list';
  applyStyle(dropdown, styles.dropdown);

  wrapper.appendChild(badge);
  wrapper.appendChild(dropdown);
  return { wrapper, dropdown };
}

/* ── Region label (zoom out) ── */
export function createRegionLabel(group: RegionGroup): HTMLElement {
  const { wrapper, dropdown } = createLabelShell(
    group.region,
    group.validators.length
  );

  const header = document.createElement('div');
  header.textContent = `${group.validators.length} validators · ${group.countries.length} countries`;
  applyStyle(header, styles.dropdownHeader);
  dropdown.appendChild(header);

  const shown = group.validators.slice(0, MAX_DROPDOWN_ROWS);
  for (const v of shown) {
    dropdown.appendChild(createValidatorRow(v, true));
  }

  if (group.validators.length > MAX_DROPDOWN_ROWS) {
    const more = document.createElement('div');
    more.textContent = `+ ${group.validators.length - MAX_DROPDOWN_ROWS} more — zoom in`;
    applyStyle(more, styles.moreRow);
    dropdown.appendChild(more);
  }

  return wrapper;
}

/* ── Country label (zoom in) ── */
export function createCountryLabel(group: CountryGroup): HTMLElement {
  // Count pill only if >1 — single-validator countries don't need it.
  const count = group.validators.length > 1 ? group.validators.length : null;
  const { wrapper, dropdown } = createLabelShell(group.country, count);

  for (const v of group.validators) {
    dropdown.appendChild(createValidatorRow(v, false));
  }

  return wrapper;
}
