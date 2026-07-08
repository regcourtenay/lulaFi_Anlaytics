import { useState } from "react";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import FilterAltOutlinedIcon from "@mui/icons-material/FilterAltOutlined";
import {
  Box, Button, Checkbox, Chip, Divider, Drawer, FormControlLabel, ListItemText,
  MenuItem, Stack, TextField, Typography,
} from "@mui/material";

import { COMPARE, FILTER_OPTIONS, GRANULARITY, PRESETS } from "../config/filterOptions";
import ExportDialog from "./ExportDialog";
import { useFilters } from "./filterState";

export default function FilterBar({ domain, allowedFilters = [], timeZones = ["Africa/Johannesburg", "UTC"], canExport }) {
  const f = useFilters();
  const [drawer, setDrawer] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const filterableDims = allowedFilters.filter((d) => FILTER_OPTIONS[d]);
  const activeCount = Object.keys(f.filters).length;

  return (
    <Box sx={{ mb: 2 }}>
      <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
        <TextField select size="small" label="Period" value={f.preset} onChange={(e) => f.set({ preset: e.target.value })} sx={{ minWidth: 150 }}>
          {PRESETS.map((p) => <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>)}
        </TextField>
        <TextField select size="small" label="Compare" value={f.compare} onChange={(e) => f.set({ compare: e.target.value })} sx={{ minWidth: 160 }}>
          {COMPARE.map((p) => <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>)}
        </TextField>
        <TextField select size="small" label="Granularity" value={f.granularity} onChange={(e) => f.set({ granularity: e.target.value })} sx={{ minWidth: 130 }}>
          {GRANULARITY.map((p) => <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>)}
        </TextField>
        <TextField select size="small" label="Time zone" value={f.timeZone} onChange={(e) => f.set({ timeZone: e.target.value })} sx={{ minWidth: 170 }}>
          {timeZones.map((tz) => <MenuItem key={tz} value={tz}>{tz}</MenuItem>)}
        </TextField>
        {filterableDims.length > 0 && (
          <Button variant="outlined" startIcon={<FilterAltOutlinedIcon />} onClick={() => setDrawer(true)}>
            Filters{activeCount ? ` (${activeCount})` : ""}
          </Button>
        )}
        <Box sx={{ flexGrow: 1 }} />
        {canExport && (
          <Button variant="contained" startIcon={<DownloadOutlinedIcon />} onClick={() => setExportOpen(true)}>Export</Button>
        )}
      </Stack>

      {activeCount > 0 && (
        <Stack direction="row" spacing={1} mt={1} flexWrap="wrap">
          {Object.entries(f.filters).map(([dim, vals]) => (
            <Chip key={dim} size="small" color="secondary" label={`${dim}: ${vals.join(", ")}`} onDelete={() => f.setFilter(dim, [])} />
          ))}
          <Button size="small" onClick={f.clearFilters}>Clear all</Button>
        </Stack>
      )}

      <Drawer anchor="right" open={drawer} onClose={() => setDrawer(false)}>
        <Box sx={{ width: 300, p: 2 }}>
          <Typography variant="h6" gutterBottom>Filters</Typography>
          <Typography variant="caption" color="text.secondary">Governed dimensions only. Values re-validated server-side.</Typography>
          <Divider sx={{ my: 1.5 }} />
          {filterableDims.map((dim) => (
            <Box key={dim} sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ textTransform: "capitalize" }}>{dim}</Typography>
              {FILTER_OPTIONS[dim].map((v) => {
                const checked = (f.filters[dim] || []).includes(v);
                return (
                  <FormControlLabel
                    key={v}
                    control={<Checkbox size="small" checked={checked} onChange={() => {
                      const cur = f.filters[dim] || [];
                      f.setFilter(dim, checked ? cur.filter((x) => x !== v) : [...cur, v]);
                    }} />}
                    label={<ListItemText primaryTypographyProps={{ variant: "body2" }} primary={v} />}
                  />
                );
              })}
            </Box>
          ))}
          <Button fullWidth variant="outlined" onClick={() => setDrawer(false)}>Done</Button>
        </Box>
      </Drawer>

      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} domain={domain} />
    </Box>
  );
}
