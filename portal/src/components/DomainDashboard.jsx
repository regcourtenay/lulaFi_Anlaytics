import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Grid, Typography } from "@mui/material";

import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { basePath } from "../config/tabs";
import BreakdownTable from "./BreakdownTable";
import FilterBar from "./FilterBar";
import Funnel from "./Funnel";
import KpiCard from "./KpiCard";
import { ErrorState, Loading } from "./PageState";
import SeriesChart from "./SeriesChart";
import StatusStrip from "./StatusStrip";
import { useFilters } from "./filterState";

export default function DomainDashboard({ domain, title }) {
  const { user, context } = useAuth();
  const nav = useNavigate();
  const filters = useFilters();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const paramKey = JSON.stringify(filters.toParams());
  useEffect(() => {
    let live = true;
    setLoading(true); setError(null);
    api.domain(domain, filters.toParams())
      .then((d) => { if (live) setData(d); })
      .catch((e) => { if (live) setError(e); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [domain, paramKey]);

  const canExport = (context?.permissions || []).some((p) => p === "analytics.provider.export" || p === "analytics.admin.view");
  const base = basePath(user.userType);
  const rowClickFor = (b) =>
    domain === "forms" && b.dimension === "formId"
      ? (row) => nav(`${base}/forms/${row.key}`)
      : undefined;

  return (
    <div>
      <Typography variant="h5" color="primary.dark" gutterBottom>{title || data?.title || domain}</Typography>
      <FilterBar domain={domain} allowedFilters={context?.allowedFilters || []} timeZones={context?.timeZones} canExport={canExport} />

      {loading && <Loading />}
      {error && <ErrorState error={error} />}

      {!loading && !error && data?.onboarding && (
        <Alert severity="info" sx={{ mt: 2 }}>
          <b>{data.onboarding.label} — {data.onboarding.status}</b>
          <Typography variant="body2">{data.onboarding.message}</Typography>
        </Alert>
      )}

      {!loading && !error && data && !data.onboarding && (
        <>
          <StatusStrip status={data.status} appliedFilters={data.appliedFilters} generatedAtUtc={data.generatedAtUtc} />

          {data.funnel && (
            <Grid container spacing={2} mb={2}>
              <Grid item xs={12} md={6}><Funnel stages={data.funnel} /></Grid>
            </Grid>
          )}

          <Grid container spacing={2}>
            {(data.cards || []).map((c) => (
              <Grid item xs={12} sm={6} md={4} lg={2.4} key={c.metricId}><KpiCard card={c} /></Grid>
            ))}
          </Grid>

          <Grid container spacing={2} mt={0.5}>
            {(data.series || []).map((s) => (
              <Grid item xs={12} md={6} key={s.metricId}><SeriesChart series={s} /></Grid>
            ))}
            {(data.breakdowns || []).map((b) => (
              <Grid item xs={12} md={6} key={b.metricId + b.dimension}><BreakdownTable breakdown={b} onRowClick={rowClickFor(b)} /></Grid>
            ))}
          </Grid>

          {(data.cards || []).length === 0 && (data.series || []).length === 0 && (
            <Typography color="text.secondary" sx={{ mt: 3 }}>No metrics available for this scope and period.</Typography>
          )}
        </>
      )}
    </div>
  );
}
