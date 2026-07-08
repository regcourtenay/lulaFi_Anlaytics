import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ScheduleIcon from "@mui/icons-material/Schedule";
import { Chip, Stack, Typography } from "@mui/material";

// Data freshness / quality strip (SDD 8.2 status strip, 21.2).
export default function StatusStrip({ status, appliedFilters, generatedAtUtc }) {
  if (!status) return null;
  const qualityColor = status.quality === "current" ? "success" : status.quality === "reconciled" ? "info" : "warning";
  return (
    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ mb: 2 }}>
      <Chip size="small" color={qualityColor} icon={<CheckCircleOutlineIcon />} label={`Quality: ${status.quality}`} />
      <Chip size="small" variant="outlined" icon={<ScheduleIcon />} label={`Freshness ${status.freshnessSeconds ?? "—"}s`} />
      {status.completeness != null && <Chip size="small" variant="outlined" label={`Completeness ${(status.completeness * 100).toFixed(1)}%`} />}
      {status.coverage != null && <Chip size="small" variant="outlined" label={`Coverage ${(status.coverage * 100).toFixed(0)}%`} />}
      {(appliedFilters || []).map((f) => (
        <Chip key={f.dimension} size="small" color="secondary" variant="outlined" label={`${f.dimension}: ${(f.values || []).join(", ")}`} />
      ))}
      {generatedAtUtc && <Typography variant="caption" color="text.disabled" sx={{ ml: "auto" }}>Generated {new Date(generatedAtUtc).toLocaleString("en-ZA")}</Typography>}
    </Stack>
  );
}
