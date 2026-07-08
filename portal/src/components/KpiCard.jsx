import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { Box, Card, CardContent, Chip, Stack, Tooltip, Typography } from "@mui/material";

import { formatValue } from "../theme";

export default function KpiCard({ card }) {
  const suppressed = card.suppressed || card.value === null;
  const cmp = card.comparison || {};
  const change = cmp.state === "available" ? cmp.percentChange : null;
  const positive = change !== null && change >= 0;
  // "Good" direction depends on whether higher is better for this metric.
  const good = change === null ? null : (card.higherIsBetter ? positive : !positive);

  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Typography variant="body2" color="text.secondary" gutterBottom noWrap title={card.name}>
          {card.name}
        </Typography>
        {suppressed ? (
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ py: 0.5 }}>
            <LockOutlinedIcon fontSize="small" color="disabled" />
            <Typography variant="body2" color="text.secondary">Suppressed</Typography>
          </Stack>
        ) : (
          <Typography variant="h4" color="primary.dark">{formatValue(card.value, card.unit)}</Typography>
        )}
        <Stack direction="row" spacing={1} alignItems="center" mt={0.5} flexWrap="wrap">
          {change !== null && (
            <Chip
              size="small"
              icon={positive ? <ArrowUpwardIcon /> : <ArrowDownwardIcon />}
              label={`${positive ? "+" : ""}${change}%`}
              color={good ? "success" : "error"}
              variant="outlined"
            />
          )}
          {card.denominator > 0 && card.unit === "percent" && (
            <Tooltip title="Numerator / denominator">
              <Typography variant="caption" color="text.secondary">
                {Intl.NumberFormat("en-ZA").format(card.numerator)} / {Intl.NumberFormat("en-ZA").format(card.denominator)}
              </Typography>
            </Tooltip>
          )}
          {card.p95 != null && (
            <Typography variant="caption" color="text.secondary">p95 {formatValue(card.p95, card.unit)}</Typography>
          )}
        </Stack>
        <Box mt={0.5}><Typography variant="caption" color="text.disabled">{card.metricId} · v{card.version}</Typography></Box>
      </CardContent>
    </Card>
  );
}
