export type ThemeMode = "light" | "dark" | "system";
export type AccentName = "blue" | "violet" | "emerald" | "rose";

const THEME_KEY = "kaoyan-theme";
const ACCENT_KEY = "kaoyan-accent";
const WORD_SIZE_KEY = "kaoyan-word-size";

export const THEME_MODES: Array<{ value: ThemeMode; label: string }> = [
  { value: "system", label: "跟随系统" },
  { value: "light", label: "浅色" },
  { value: "dark", label: "深色" },
];

export const ACCENTS: Array<{ value: AccentName; label: string; color: string }> =
  [
    { value: "blue", label: "靛蓝", color: "#4c6fff" },
    { value: "violet", label: "紫罗兰", color: "#8b5cf6" },
    { value: "emerald", label: "翡翠绿", color: "#0e9f6e" },
    { value: "rose", label: "玫瑰红", color: "#e11d66" },
  ];

export const WORD_SIZE_MIN = 28;
export const WORD_SIZE_MAX = 56;
export const WORD_SIZE_STEP = 4;

const DARK_MEDIA = "(prefers-color-scheme: dark)";

function resolveDark(mode: ThemeMode): boolean {
  if (mode === "dark") {
    return true;
  }
  if (mode === "light") {
    return false;
  }
  return window.matchMedia(DARK_MEDIA).matches;
}

function apply(mode: ThemeMode, accent: AccentName) {
  document.documentElement.dataset.theme = resolveDark(mode) ? "dark" : "light";
  document.documentElement.dataset.accent = accent;
}

export function getThemeMode(): ThemeMode {
  const saved = localStorage.getItem(THEME_KEY);
  return saved === "light" || saved === "dark" || saved === "system"
    ? saved
    : "system";
}

export function setThemeMode(mode: ThemeMode) {
  localStorage.setItem(THEME_KEY, mode);
  apply(mode, getAccent());
}

export function getAccent(): AccentName {
  const saved = localStorage.getItem(ACCENT_KEY);
  return ACCENTS.some((item) => item.value === saved)
    ? (saved as AccentName)
    : "blue";
}

export function setAccent(accent: AccentName) {
  localStorage.setItem(ACCENT_KEY, accent);
  apply(getThemeMode(), accent);
}

/** 复习页大词字号偏好（px）。 */
export function getWordSize(): number {
  const saved = Number(localStorage.getItem(WORD_SIZE_KEY));
  if (!Number.isFinite(saved) || saved < WORD_SIZE_MIN || saved > WORD_SIZE_MAX) {
    return 40;
  }
  return saved;
}

export function setWordSize(size: number) {
  const clamped = Math.min(
    WORD_SIZE_MAX,
    Math.max(WORD_SIZE_MIN, Math.round(size)),
  );
  localStorage.setItem(WORD_SIZE_KEY, String(clamped));
  document.documentElement.style.setProperty(
    "--word-main-size",
    `${clamped}px`,
  );
  return clamped;
}

/** 应用持久化的主题/主题色/字号；跟随系统时监听系统切换。在 React 渲染前调用。 */
export function initTheme() {
  apply(getThemeMode(), getAccent());
  setWordSize(getWordSize());
  window
    .matchMedia(DARK_MEDIA)
    .addEventListener("change", () => apply(getThemeMode(), getAccent()));
}
