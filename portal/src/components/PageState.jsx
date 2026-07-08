import { Alert, Box, CircularProgress, Typography } from "@mui/material";

export function Loading() {
  return <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>;
}
export function ErrorState({ error }) {
  return (
    <Alert severity="error" sx={{ my: 2 }}>
      {error?.message || "Something went wrong."}
      {error?.data?.correlationId && <Typography variant="caption" display="block">Correlation: {error.data.correlationId}</Typography>}
    </Alert>
  );
}
export function EmptyState({ message }) {
  return <Box sx={{ py: 6, textAlign: "center" }}><Typography color="text.secondary">{message}</Typography></Box>;
}
