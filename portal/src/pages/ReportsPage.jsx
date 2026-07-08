import { useEffect, useState } from "react";
import {
  Card, CardContent, Chip, Grid, List, ListItem, ListItemText, Typography,
} from "@mui/material";

import { api } from "../api/client";
import { ErrorState, Loading } from "../components/PageState";

export default function ReportsPage() {
  const [state, setState] = useState({ views: [], exports: [], schedules: [], alerts: [] });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    Promise.all([api.savedViews(), api.exports(), api.schedules(), api.alerts()])
      .then(([v, e, s, a]) => live && setState({ views: v.views, exports: e.jobs, schedules: s.schedules, alerts: a.rules }))
      .catch((err) => live && setError(err))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, []);

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} />;

  return (
    <div>
      <Typography variant="h5" color="primary.dark" gutterBottom>Reports, Saved Views &amp; Alerts</Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Card><CardContent>
            <Typography variant="subtitle2" color="primary.dark" gutterBottom>Saved views</Typography>
            <List dense>
              {state.views.length === 0 && <Typography variant="body2" color="text.secondary">None yet.</Typography>}
              {state.views.map((v) => (
                <ListItem key={v._id} secondaryAction={<Chip size="small" label={v.visibility} />}>
                  <ListItemText primary={v.name} secondary={v.route} />
                </ListItem>
              ))}
            </List>
          </CardContent></Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card><CardContent>
            <Typography variant="subtitle2" color="primary.dark" gutterBottom>Export history</Typography>
            <List dense>
              {state.exports.length === 0 && <Typography variant="body2" color="text.secondary">No exports yet — use the Export button on any dashboard.</Typography>}
              {state.exports.map((j) => (
                <ListItem key={j.jobId} secondaryAction={<Chip size="small" color={j.status === "completed" ? "success" : "default"} label={j.status} />}>
                  <ListItemText
                    primary={`${j.jobId} · ${j.format.toUpperCase()}`}
                    secondary={j.status === "completed" && j.downloadUrl ? <a href={j.downloadUrl}>download ({j.rowCount} rows)</a> : `created ${new Date(j.createdAt).toLocaleString("en-ZA")}`}
                  />
                </ListItem>
              ))}
            </List>
          </CardContent></Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card><CardContent>
            <Typography variant="subtitle2" color="primary.dark" gutterBottom>Scheduled reports</Typography>
            <List dense>
              {state.schedules.length === 0 && <Typography variant="body2" color="text.secondary">None.</Typography>}
              {state.schedules.map((s) => (
                <ListItem key={s._id} secondaryAction={<Chip size="small" label={s.recurrence} />}>
                  <ListItemText primary={s.name} secondary={`${s.format?.toUpperCase()} → ${(s.recipients || []).join(", ")}`} />
                </ListItem>
              ))}
            </List>
          </CardContent></Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card><CardContent>
            <Typography variant="subtitle2" color="primary.dark" gutterBottom>Threshold alerts</Typography>
            <List dense>
              {state.alerts.length === 0 && <Typography variant="body2" color="text.secondary">None.</Typography>}
              {state.alerts.map((a) => (
                <ListItem key={a._id} secondaryAction={<Chip size="small" color={a.lastState === "breached" ? "error" : "success"} label={a.lastState} />}>
                  <ListItemText primary={a.name} secondary={`${a.metricId} ${a.operator} ${a.threshold}`} />
                </ListItem>
              ))}
            </List>
          </CardContent></Card>
        </Grid>
      </Grid>
    </div>
  );
}
