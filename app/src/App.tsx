import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { RequireAuth } from "./components/layout/RequireAuth";
import Login from "./pages/Login";
import type { Role } from "./data/types";
import Landing from "./pages/Landing";
import Join from "./pages/Join";
import CustomerHome from "./pages/customer/Home";
import Shop from "./pages/customer/Shop";
import WalletPage from "./pages/customer/Wallet";
import Bills from "./pages/customer/Bills";
import Help from "./pages/customer/Help";
import RiderRound from "./pages/rider/Round";
import RiderSummary from "./pages/rider/Summary";
import AdminOverview from "./pages/admin/Overview";
import LiveRoutes from "./pages/admin/LiveRoutes";
import Tickets from "./pages/admin/Tickets";
import Customers from "./pages/admin/Customers";
import Quality from "./pages/admin/Quality";
import Analytics from "./pages/admin/Analytics";
import Demand from "./pages/admin/Demand";

const shell = (role: Role, el: JSX.Element) => (
  <RequireAuth role={role}>
    <AppShell>{el}</AppShell>
  </RequireAuth>
);

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/join" element={<Join />} />
      <Route path="/customer" element={shell("customer", <CustomerHome />)} />
      <Route path="/customer/shop" element={shell("customer", <Shop />)} />
      <Route path="/customer/wallet" element={shell("customer", <WalletPage />)} />
      <Route path="/customer/history" element={shell("customer", <Bills />)} />
      <Route path="/customer/help" element={shell("customer", <Help />)} />
      <Route path="/rider" element={shell("rider", <RiderRound />)} />
      <Route path="/rider/summary" element={shell("rider", <RiderSummary />)} />
      <Route path="/admin" element={shell("admin", <AdminOverview />)} />
      <Route path="/admin/routes" element={shell("admin", <LiveRoutes />)} />
      <Route path="/admin/tickets" element={shell("admin", <Tickets />)} />
      <Route path="/admin/customers" element={shell("admin", <Customers />)} />
      <Route path="/admin/analytics" element={shell("admin", <Analytics />)} />
      <Route path="/admin/demand" element={shell("admin", <Demand />)} />
      <Route path="/admin/quality" element={shell("admin", <Quality />)} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
