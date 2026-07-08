import { Card, CardContent, Typography } from "@mui/material";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import { formatValue } from "../theme";

export default function SeriesChart({ series }) {
  const data = (series.points || []).map((p) => ({ bucket: p.bucket?.slice(5), value: p.value ?? 0 }));
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Typography variant="subtitle2" color="primary.dark" gutterBottom>
          {series.name}
        </Typography>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 5, right: 8, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id={`g-${series.metricId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1852c7" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#1852c7" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef1f7" />
            <XAxis dataKey="bucket" tick={{ fontSize: 11 }} minTickGap={24} />
            <YAxis tick={{ fontSize: 11 }} width={44} />
            <Tooltip formatter={(v) => formatValue(v, series.unit)} labelStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="value" stroke="#1852c7" strokeWidth={2} fill={`url(#g-${series.metricId})`} />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
