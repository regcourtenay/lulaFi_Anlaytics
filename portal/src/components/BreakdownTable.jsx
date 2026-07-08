import {
  Box, Card, CardContent, LinearProgress, Table, TableBody, TableCell,
  TableHead, TableRow, Typography,
} from "@mui/material";

import { formatValue } from "../theme";

export default function BreakdownTable({ breakdown, title, onRowClick }) {
  const rows = breakdown.rows || [];
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.value ?? 0)));
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Typography variant="subtitle2" color="primary.dark" gutterBottom>
          {title || `${breakdown.name} by ${breakdown.dimension}`}
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{breakdown.dimension}</TableCell>
              <TableCell align="right">{breakdown.unit === "percent" ? "%" : "Value"}</TableCell>
              <TableCell width="40%" />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={3}><Typography variant="body2" color="text.secondary">No data in range.</Typography></TableCell></TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.key} hover onClick={onRowClick ? () => onRowClick(r) : undefined}
                sx={onRowClick ? { cursor: "pointer" } : undefined}>
                <TableCell><Typography variant="body2" noWrap title={r.label || r.key} color={onRowClick ? "primary" : "inherit"}>{r.label || r.key}</Typography></TableCell>
                <TableCell align="right"><Typography variant="body2" fontWeight={600}>{formatValue(r.value, breakdown.unit)}</Typography></TableCell>
                <TableCell>
                  <LinearProgress variant="determinate" value={Math.min(100, (Math.abs(r.value ?? 0) / max) * 100)} sx={{ height: 6, borderRadius: 1 }} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {breakdown.suppressedGroups > 0 && (
          <Box mt={1}><Typography variant="caption" color="text.secondary">{breakdown.suppressedGroups} group(s) suppressed (min cohort {breakdown.minimumCohort}).</Typography></Box>
        )}
      </CardContent>
    </Card>
  );
}
