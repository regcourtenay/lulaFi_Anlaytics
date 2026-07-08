import { Box, Card, CardContent, Stack, Typography } from "@mui/material";

// Form journey funnel (SDD 10.3): views -> starts -> step -> submitted.
export default function Funnel({ stages, title = "Journey funnel" }) {
  const top = Math.max(1, ...stages.map((s) => s.count));
  const colors = ["#5b81e0", "#1852c7", "#0fa3a3", "#0b7d7d"];
  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle2" color="primary.dark" gutterBottom>{title}</Typography>
        <Stack spacing={1.2} mt={1}>
          {stages.map((s, i) => {
            const pct = (s.count / top) * 100;
            const conv = i > 0 && stages[i - 1].count > 0 ? Math.round((s.count / stages[i - 1].count) * 100) : null;
            return (
              <Box key={s.stage}>
                <Stack direction="row" justifyContent="space-between" mb={0.3}>
                  <Typography variant="body2" sx={{ textTransform: "capitalize" }}>{s.stage.replace("_", " ")}</Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {Intl.NumberFormat("en-ZA").format(s.count)}
                    {conv !== null && <Typography component="span" variant="caption" color="text.secondary"> · {conv}%</Typography>}
                  </Typography>
                </Stack>
                <Box sx={{ height: 20, borderRadius: 1, bgcolor: "#eef1f7", overflow: "hidden" }}>
                  <Box sx={{ height: "100%", width: `${Math.max(2, pct)}%`, bgcolor: colors[i % colors.length], transition: "width .3s" }} />
                </Box>
              </Box>
            );
          })}
        </Stack>
      </CardContent>
    </Card>
  );
}
