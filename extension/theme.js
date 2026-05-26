/** Fluxpage extension theme — shared CSS token values (UI only) */
const FLUXPAGE_THEME = {
  bg: "#F8FAFC",
  surface: "#FFFFFF",
  text: "#0B1220",
  muted: "#64748B",
  border: "rgba(15, 23, 42, 0.08)",
  primary: "#0369A1",
  primaryHover: "#075985",
  accent: "#7C3AED",
  success: "#16A34A",
  warning: "#D97706",
  danger: "#DC2626",
  headerBg: "#FFFFFF",
  headerText: "#0B1220",
  tabActive: "#0369A1",
  panelBg: "rgba(248, 250, 252, 0.92)",
  cardBg: "rgba(255, 255, 255, 0.96)",
  brandName: "Fluxpage",
  brandMark: "F",
};

if (typeof globalThis !== "undefined") {
  globalThis.__FLUXPAGE_THEME__ = FLUXPAGE_THEME;
}
