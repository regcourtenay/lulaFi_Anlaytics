import { useEffect, useState } from "react";
import { Link as RouterLink, useParams } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Breadcrumbs, Button, Grid, Link, Typography } from "@mui/material";

import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import BreakdownTable from "../components/BreakdownTable";
import Funnel from "../components/Funnel";
import KpiCard from "../components/KpiCard";
import { ErrorState, Loading } from "../components/PageState";
import { useFilters } from "../components/filterState";
import { basePath } from "../config/tabs";

export default function FormDrillPage() {
  const { formId } = useParams();
  const { user } = useAuth();
  const filters = useFilters();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const base = basePath(user.userType);

  const paramKey = JSON.stringify(filters.toParams());
  useEffect(() => {
    let live = true; setLoading(true); setError(null);
    api.formDrill(formId, filters.toParams())
      .then((d) => live && setData(d)).catch((e) => live && setError(e)).finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [formId, paramKey]);

  return (
    <div>
      <Breadcrumbs sx={{ mb: 1 }}>
        <Link component={RouterLink} to={`${base}/forms`} underline="hover">Forms</Link>
        <Typography color="text.primary">{data?.form?.title || "Form"}</Typography>
      </Breadcrumbs>
      <Button component={RouterLink} to={`${base}/forms`} startIcon={<ArrowBackIcon />} size="small" sx={{ mb: 2 }}>Back to Forms</Button>

      {loading && <Loading />}
      {error && <ErrorState error={error} />}
      {data && (
        <>
          <Typography variant="h5" color="primary.dark" gutterBottom>{data.form.title}</Typography>
          <Typography variant="caption" color="text.secondary">Status {data.form.status} · v{data.form.version} · signed drill re-authorised at operational layer (SDD 10.4)</Typography>
          <Grid container spacing={2} mt={0.5}>
            <Grid item xs={12} md={5}><Funnel stages={data.funnel} title="Form journey funnel" /></Grid>
            <Grid item xs={12} md={7}>
              <Grid container spacing={2}>
                {data.cards.map((c) => <Grid item xs={12} sm={4} key={c.metricId}><KpiCard card={c} /></Grid>)}
                <Grid item xs={12}><BreakdownTable breakdown={data.breakdown} title="Conversion by channel" /></Grid>
              </Grid>
            </Grid>
          </Grid>
        </>
      )}
    </div>
  );
}
