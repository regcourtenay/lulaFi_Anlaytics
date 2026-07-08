import { createTheme } from "@mui/material/styles";

// lulaFi Portal visual system (SDD 10): light neutral background, white MUI
// surfaces, primary blue, teal accent, rounded controls, accessible status.
export const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#1852c7", dark: "#123a8f", light: "#5b81e0" },
    secondary: { main: "#0fa3a3", dark: "#0b7d7d" },
    background: { default: "#f4f6fb", paper: "#ffffff" },
    success: { main: "#1d8a4c" },
    warning: { main: "#c97a12" },
    error: { main: "#c0392b" },
    text: { primary: "#1c2536", secondary: "#5b6472" },
    divider: "#e3e8f0",
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: "'Inter','Segoe UI',Roboto,system-ui,Arial,sans-serif",
    h4: { fontWeight: 700 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 600 },
    subtitle2: { fontWeight: 600 },
  },
  components: {
    MuiCard: { defaultProps: { elevation: 0 }, styleOverrides: { root: { border: "1px solid #e3e8f0" } } },
    MuiButton: { defaultProps: { disableElevation: true }, styleOverrides: { root: { textTransform: "none", fontWeight: 600 } } },
    MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
  },
});

// Format a metric value by unit.
export function formatValue(value, unit) {
  if (value === null || value === undefined) return "—";
  if (unit === "percent") return `${round(value, 1)}%`;
  if (unit === "ms") return formatDuration(value);
  if (unit === "currency") return `R ${Intl.NumberFormat("en-ZA").format(Math.round(value))}`;
  return Intl.NumberFormat("en-ZA").format(round(value, 2));
}
function round(v, dp) { const f = 10 ** dp; return Math.round(v * f) / f; }
function formatDuration(ms) {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const s = ms / 1000;
  if (s < 90) return `${round(s, 1)} s`;
  const m = s / 60;
  if (m < 90) return `${round(m, 1)} min`;
  const h = m / 60;
  if (h < 48) return `${round(h, 1)} h`;
  return `${round(h / 24, 1)} d`;
}
