import { useEffect, useState } from "react";
import {
  Card, CardContent, Chip, Grid, Table, TableBody, TableCell, TableHead, TableRow,
  Typography,
} from "@mui/material";

import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import FilterBar from "../components/FilterBar";
import { ErrorState, Loading } from "../components/PageState";
import { formatValue } from "../theme";
import { useFilters } from "../components/filterState";

function CohortCard({ title, rows }) {
  const max = Math.max(1, ...rows.map((r) => r.submissions));
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Typography variant="subtitle2" color="primary.dark" gutterBottom>{title}</Typography>
        {rows.map((r) => (
          <div key={r.key} style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <Typography variant="body2">{r.key}</Typography>
              <Typography variant="body2" fontWeight={600}>{formatValue(r.submissions, "count")}</Typography>
            </div>
            <div style={{ height: 6, background: "#eef1f7", borderRadius: 3 }}>
              <div style={{ height: "100%", width: `${(r.submissions / max) * 100}%`, background: "#0fa3a3", borderRadius: 3 }} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function AdminProvidersPage() {
  const { context } = useAuth();
  const filters = useFilters();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const canDrill = (context?.permissions || []).includes("analytics.admin.provider_detail");

  const paramKey = JSON.stringify(filters.toParams());
  useEffect(() => {
    let live = true; setLoading(true); setError(null);
    api.providers(filters.toParams()).then((d) => live && setData(d)).catch((e) => live && setError(e)).finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [paramKey]);

  return (
    <div>
      <Typography variant="h5" color="primary.dark" gutterBottom>Providers &amp; Cohorts</Typography>
      <FilterBar domain="overview" allowedFilters={[]} timeZones={context?.timeZones} />
      {!canDrill && <Chip size="small" color="warning" variant="outlined" sx={{ mb: 2 }} label="Provider names restricted — needs analytics.admin.provider_detail" />}
      {loading && <Loading />}
      {error && <ErrorState error={error} />}
      {data && (
        <>
          <Grid container spacing={2}>
            <Grid item xs={12} md={3}><CohortCard title="By industry" rows={data.cohorts.industry} /></Grid>
            <Grid item xs={12} md={3}><CohortCard title="By tier" rows={data.cohorts.tier} /></Grid>
            <Grid item xs={12} md={3}><CohortCard title="By onboarding month" rows={data.cohorts.onboardingMonth} /></Grid>
            <Grid item xs={12} md={3}><CohortCard title="By geography" rows={data.cohorts.geography} /></Grid>
          </Grid>

          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="subtitle2" color="primary.dark" gutterBottom>Provider ranking (submissions)</Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Provider</TableCell><TableCell>Industry</TableCell><TableCell>Tier</TableCell>
                    <TableCell align="right">Active users</TableCell><TableCell align="right">Submissions</TableCell><TableCell align="right">Conversion</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.providers.slice(0, 20).map((p, i) => (
                    <TableRow key={p.providerRealmId || i} hover>
                      <TableCell>{p.name}</TableCell>
                      <TableCell>{p.industry}</TableCell>
                      <TableCell><Chip size="small" label={p.tier} /></TableCell>
                      <TableCell align="right">{formatValue(p.activeUsers, "count")}</TableCell>
                      <TableCell align="right">{formatValue(p.submissions, "count")}</TableCell>
                      <TableCell align="right">{p.conversion == null ? "—" : formatValue(p.conversion, "percent")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
