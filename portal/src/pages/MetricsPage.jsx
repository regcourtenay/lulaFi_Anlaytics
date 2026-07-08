import { useEffect, useState } from "react";
import {
  Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from "@mui/material";

import { api } from "../api/client";
import { ErrorState, Loading } from "../components/PageState";

export default function MetricsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ metricId: "", name: "", calculationType: "count", domain: "custom", unit: "count" });
  const [msg, setMsg] = useState(null);

  function load() {
    setLoading(true);
    api.metricDefinitions().then(setData).catch(setError).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function create() {
    setMsg(null);
    try {
      const res = await api.createMetricDefinition(form);
      setMsg(`Draft ${res.definition.metricId} v${res.definition.version} created (requires approval).`);
      setOpen(false); load();
    } catch (e) { setMsg(e.message); }
  }

  return (
    <div>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
        <Typography variant="h5" color="primary.dark">Metric Catalogue</Typography>
        {data?.canManage && <Button variant="contained" onClick={() => setOpen(true)}>New draft metric</Button>}
      </Stack>
      <Typography variant="body2" color="text.secondary" gutterBottom>Versioned definitions with formula, sources and suppression (SDD 14.2). Active versions are immutable.</Typography>
      {msg && <Typography variant="body2" color="secondary.dark" sx={{ mb: 1 }}>{msg}</Typography>}
      {loading && <Loading />}
      {error && <ErrorState error={error} />}
      {data && (
        <Card>
          <CardContent>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Metric</TableCell><TableCell>Name</TableCell><TableCell>Domain</TableCell>
                  <TableCell>Type</TableCell><TableCell>Version</TableCell><TableCell>Min cohort</TableCell><TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.definitions.map((d) => (
                  <TableRow key={d.metricId + d.version} hover>
                    <TableCell>{d.metricId}</TableCell>
                    <TableCell>{d.name}</TableCell>
                    <TableCell>{d.domain}</TableCell>
                    <TableCell>{d.calculationType}</TableCell>
                    <TableCell>v{d.version}</TableCell>
                    <TableCell>{d.suppression?.minimumDenominator ?? 0}</TableCell>
                    <TableCell><Chip size="small" color={d.status === "active" ? "success" : "default"} label={d.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>New draft metric</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField size="small" label="Metric ID" value={form.metricId} onChange={(e) => setForm({ ...form, metricId: e.target.value })} placeholder="KPI-100" />
            <TextField size="small" label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <TextField select size="small" label="Calculation type" value={form.calculationType} onChange={(e) => setForm({ ...form, calculationType: e.target.value })}>
              {["count", "rate", "ratio", "percentile"].map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </TextField>
            <Typography variant="caption" color="text.secondary">Created as a draft version; requires approval and an effective date before it calculates (SDD 10.7).</Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={create} disabled={!form.metricId || !form.name}>Create draft</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
