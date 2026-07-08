import { useEffect, useState } from "react";
import {
  Card, CardContent, Chip, Grid, Table, TableBody, TableCell, TableHead, TableRow, Typography,
} from "@mui/material";

import { api } from "../api/client";
import { ErrorState, Loading } from "../components/PageState";

const statusColor = (s) => ({ reconciled: "success", current: "success", variance: "error", partial: "warning", delayed: "warning" }[s] || "default");

export default function DataQualityPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    api.dataQuality().then((d) => live && setData(d)).catch((e) => live && setError(e)).finally(() => live && setLoading(false));
    return () => { live = false; };
  }, []);

  return (
    <div>
      <Typography variant="h5" color="primary.dark" gutterBottom>Data Quality &amp; Reconciliation</Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>Freshness, completeness and source reconciliation (SDD 21.2/21.3).</Typography>
      {loading && <Loading />}
      {error && <ErrorState error={error} />}
      {data && (
        <>
          <Grid container spacing={2} mt={0.5}>
            {data.summary.map((s) => (
              <Grid item xs={12} sm={6} md={4} lg={2.4} key={s.source}>
                <Card sx={{ height: "100%" }}>
                  <CardContent>
                    <Typography variant="body2" color="text.secondary" sx={{ textTransform: "capitalize" }}>{s.source}</Typography>
                    <Chip size="small" color={statusColor(s.status)} label={s.status} sx={{ my: 0.5 }} />
                    <Typography variant="body2">Variance {s.variancePct}%</Typography>
                    <Typography variant="caption" color="text.secondary" display="block">Freshness {s.freshnessSeconds}s · {(s.completeness * 100).toFixed(1)}% complete</Typography>
                    {s.affectedMetrics?.length > 0 && <Typography variant="caption" color="error">Affects {s.affectedMetrics.join(", ")}</Typography>}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="subtitle2" color="primary.dark" gutterBottom>Recent reconciliation runs</Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Source</TableCell><TableCell>Period end</TableCell>
                    <TableCell align="right">Expected</TableCell><TableCell align="right">Received</TableCell>
                    <TableCell align="right">Variance</TableCell><TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.runs.map((r, i) => (
                    <TableRow key={i} hover>
                      <TableCell sx={{ textTransform: "capitalize" }}>{r.source}</TableCell>
                      <TableCell>{new Date(r.periodEndUtc).toLocaleDateString("en-ZA")}</TableCell>
                      <TableCell align="right">{Intl.NumberFormat("en-ZA").format(r.expected)}</TableCell>
                      <TableCell align="right">{Intl.NumberFormat("en-ZA").format(r.received)}</TableCell>
                      <TableCell align="right">{r.variancePct}%</TableCell>
                      <TableCell><Chip size="small" color={statusColor(r.status)} label={r.status} /></TableCell>
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
