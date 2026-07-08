import { useState } from "react";
import {
  Button, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress,
  MenuItem, Stack, TextField, Typography,
} from "@mui/material";

import { api } from "../api/client";
import { useFilters } from "./filterState";

// Controlled export dialog (SDD 10.6 / 19). Estimates, queues, polls job status.
export default function ExportDialog({ open, onClose, domain }) {
  const filters = useFilters();
  const [format, setFormat] = useState("xlsx");
  const [job, setJob] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit() {
    setBusy(true); setError(null); setJob(null);
    try {
      const params = filters.toParams();
      const { jobId } = await api.createExport({ domain, format, ...params });
      // Poll with backoff until terminal (SDD 8.5).
      let delay = 600;
      for (let i = 0; i < 12; i++) {
        await new Promise((r) => setTimeout(r, delay));
        const j = await api.exportJob(jobId);
        setJob(j);
        if (["completed", "failed", "expired"].includes(j.status)) break;
        delay = Math.min(delay * 1.5, 3000);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Export {domain}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          <TextField select label="Format" size="small" value={format} onChange={(e) => setFormat(e.target.value)}>
            <MenuItem value="csv">CSV</MenuItem>
            <MenuItem value="xlsx">Excel (XLSX)</MenuItem>
            <MenuItem value="pdf">PDF</MenuItem>
          </TextField>
          <Typography variant="caption" color="text.secondary">
            The export reconstructs the authorised query server-side, escapes spreadsheet formulas,
            includes metric versions and expires automatically (SDD 19.2).
          </Typography>
          {busy && <LinearProgress />}
          {job && (
            <Typography variant="body2">
              Job <b>{job.jobId}</b>: {job.status}
              {job.status === "completed" && job.downloadUrl && (
                <> — <a href={job.downloadUrl}>download {job.format.toUpperCase()}</a> ({job.rowCount} rows)</>
              )}
            </Typography>
          )}
          {error && <Typography color="error" variant="body2">{error}</Typography>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button variant="contained" onClick={submit} disabled={busy}>Create export</Button>
      </DialogActions>
    </Dialog>
  );
}
