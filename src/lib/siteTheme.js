/** Default site theme (matches :root in index.css). */
export const DEFAULT_THEME = {
  accent: '#3F68FE',
  background: '#030712',
};

/** Previous brand accent — migrate saved configs to the new default. */
export const LEGACY_ACCENT = '#00E5FF';

const HEX6 = /^#[0-9A-Fa-f]{6}$/;
const HEX3 = /^#[0-9A-Fa-f]{3}$/;

/** Normalize user input to #RRGGBB or null. */
export function normalizeHexColor(value) {
  if (value == null || value === '') return null;
  const s = String(value).trim();
  if (HEX6.test(s)) return s.toUpperCase();
  if (HEX3.test(s)) {
    const [, r, g, b] = s;
    return (`#${r}${r}${g}${g}${b}${b}`).toUpperCase();
  }
  return null;
}

export function hexToRgb(hex) {
  const n = normalizeHexColor(hex);
  if (!n) return null;
  const v = parseInt(n.slice(1), 16);
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
}

function mixHex(a, b, t) {
  const c1 = hexToRgb(a);
  const c2 = hexToRgb(b);
  if (!c1 || !c2) return a;
  const r = Math.round(c1.r + (c2.r - c1.r) * t);
  const g = Math.round(c1.g + (c2.g - c1.g) * t);
  const bl = Math.round(c1.b + (c2.b - c1.b) * t);
  return `#${[r, g, bl].map((x) => x.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

function rgba(hex, alpha) {
  const c = hexToRgb(hex);
  if (!c) return `rgba(63, 104, 254, ${alpha})`;
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`;
}

export function resolveTheme(theme) {
  let accent = normalizeHexColor(theme?.accent) || DEFAULT_THEME.accent;
  if (accent === LEGACY_ACCENT) accent = DEFAULT_THEME.accent;
  const background = normalizeHexColor(theme?.background) || DEFAULT_THEME.background;
  return { accent, background };
}

/** Merge theme into site config; migrates legacy cyan and fills missing theme. */
export function normalizeSiteConfigTheme(cfg) {
  const base = cfg && typeof cfg === 'object' ? cfg : {};
  const theme = resolveTheme(base.theme);
  const migrated = normalizeHexColor(base.theme?.accent) === LEGACY_ACCENT;
  const filled = !base.theme?.accent;
  return {
    config: { ...base, theme },
    changed: migrated || filled,
  };
}

/** Apply theme colors to document CSS variables (public site + admin preview). */
export function applySiteTheme(theme) {
  if (typeof document === 'undefined') return;
  const { accent, background } = resolveTheme(theme);
  const root = document.documentElement;
  const hover = mixHex(accent, '#FFFFFF', 0.22);
  const gradientEnd = mixHex(accent, '#000000', 0.35);
  const rgb = hexToRgb(accent);
  const bgSecondary = mixHex(background, '#FFFFFF', 0.08);
  const bgGlassRgb = hexToRgb(mixHex(background, '#FFFFFF', 0.06));

  if (rgb) root.style.setProperty('--accent-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
  root.style.setProperty('--accent-gradient-end', gradientEnd);
  root.style.setProperty('--accent-primary', accent);
  root.style.setProperty('--accent-primary-hover', hover);
  root.style.setProperty('--accent-glow', rgba(accent, 0.35));
  root.style.setProperty('--border-primary', rgba(accent, 0.3));
  root.style.setProperty('--border-glass', rgba(accent, 0.16));
  root.style.setProperty('--border-glass-inset', 'rgba(255, 255, 255, 0.05)');
  root.style.setProperty('--primary-color', background);
  root.style.setProperty('--bg-secondary', bgSecondary);
  root.style.setProperty(
    '--bg-glass',
    bgGlassRgb
      ? `rgba(${bgGlassRgb.r}, ${bgGlassRgb.g}, ${bgGlassRgb.b}, 0.7)`
      : 'rgba(17, 24, 39, 0.7)',
  );
  root.style.setProperty('--surface-nav', `${background}EB`);
  root.style.setProperty('--shadow-btn', `0 2px 12px ${rgba(accent, 0.14)}`);
  root.style.setProperty('--shadow-btn-hover', `0 4px 20px ${rgba(accent, 0.22)}`);
  root.style.setProperty('--selection-bg', rgba(accent, 0.25));
  root.style.setProperty('--theme-glow-1', rgba(accent, 0.1));
  root.style.setProperty('--theme-glow-4', rgba(accent, 0.05));
  root.style.setProperty('--theme-grid-dot', rgba(accent, 0.07));
  root.style.setProperty('--theme-bg-mid', mixHex(background, accent, 0.06));
  root.style.setProperty('--theme-bg-deep', mixHex(background, accent, 0.12));
  root.dataset.siteTheme = 'custom';
}

export function clearSiteThemeOverrides() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const keys = [
    '--accent-primary',
    '--accent-primary-hover',
    '--accent-glow',
    '--border-primary',
    '--border-glass',
    '--primary-color',
    '--bg-secondary',
    '--bg-glass',
    '--surface-nav',
    '--shadow-btn',
    '--shadow-btn-hover',
    '--selection-bg',
    '--theme-glow-1',
    '--theme-glow-4',
    '--theme-grid-dot',
    '--theme-bg-mid',
    '--theme-bg-deep',
    '--accent-rgb',
    '--accent-gradient-end',
  ];
  keys.forEach((k) => root.style.removeProperty(k));
  delete root.dataset.siteTheme;
}

export const THEME_PRESETS = [
  { id: 'default', label: 'أزرق (افتراضي)', accent: '#3F68FE', background: '#030712' },
  { id: 'cyan', label: 'سماوي', accent: '#00E5FF', background: '#030712' },
  { id: 'blue', label: 'أزرق', accent: '#3B82F6', background: '#0B1220' },
  { id: 'emerald', label: 'أخضر', accent: '#10B981', background: '#04120C' },
  { id: 'violet', label: 'بنفسجي', accent: '#A78BFA', background: '#12081F' },
  { id: 'amber', label: 'ذهبي', accent: '#F59E0B', background: '#140F03' },
  { id: 'rose', label: 'وردي', accent: '#F43F5E', background: '#14060A' },
];
