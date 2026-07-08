import { Navigate, Route, Routes } from "react-router-dom";

import AnalyticsShell from "./components/AnalyticsShell";
import DomainDashboard from "./components/DomainDashboard";
import { Loading } from "./components/PageState";
import { useAuth } from "./auth/AuthContext";
import { basePath } from "./config/tabs";
import AdminProvidersPage from "./pages/AdminProvidersPage";
import DataQualityPage from "./pages/DataQualityPage";
import FormDrillPage from "./pages/FormDrillPage";
import FormsPage from "./pages/FormsPage";
import LoginPage from "./pages/LoginPage";
import MetricsPage from "./pages/MetricsPage";
import ReportsPage from "./pages/ReportsPage";

function RequireScope({ scope, children }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  const expected = user.userType === "provider" ? "provider" : "admin";
  if (scope !== expected) return <Navigate to={basePath(user.userType)} replace />;
  return children;
}

function Root() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  return <Navigate to={user ? basePath(user.userType) : "/login"} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Root />} />
      <Route path="/login" element={<LoginPage />} />

      <Route path="/portal/provider/analytics" element={<RequireScope scope="provider"><AnalyticsShell /></RequireScope>}>
        <Route index element={<DomainDashboard domain="overview" title="Overview" />} />
        <Route path="forms" element={<FormsPage />} />
        <Route path="forms/:formId" element={<FormDrillPage />} />
        <Route path="operations" element={<DomainDashboard domain="operations" />} />
        <Route path="messaging" element={<DomainDashboard domain="messaging" />} />
        <Route path="notifications" element={<DomainDashboard domain="notifications" />} />
        <Route path="connectors" element={<DomainDashboard domain="connectors" />} />
        <Route path="advertising" element={<DomainDashboard domain="advertising" />} />
        <Route path="reports" element={<ReportsPage />} />
      </Route>

      <Route path="/portal/admin/analytics" element={<RequireScope scope="admin"><AnalyticsShell /></RequireScope>}>
        <Route index element={<DomainDashboard domain="overview" title="Global Overview" />} />
        <Route path="providers" element={<AdminProvidersPage />} />
        <Route path="platform" element={<DomainDashboard domain="platform" />} />
        <Route path="data-quality" element={<DataQualityPage />} />
        <Route path="advertising" element={<DomainDashboard domain="advertising" />} />
        <Route path="commercial" element={<DomainDashboard domain="commercial" />} />
        <Route path="metrics" element={<MetricsPage />} />
        <Route path="reports" element={<ReportsPage />} />
      </Route>

      <Route path="*" element={<Root />} />
    </Routes>
  );
}
