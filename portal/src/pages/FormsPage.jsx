import { Typography } from "@mui/material";

import DomainDashboard from "../components/DomainDashboard";

// Forms tab = generic domain dashboard for "forms" (includes journey funnel and
// a clickable form breakdown that drills into the per-form view).
export default function FormsPage() {
  return (
    <>
      <DomainDashboard domain="forms" title="Forms" />
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>
        Tip: select a form in the breakdown to open its journey drill-down.
      </Typography>
    </>
  );
}
