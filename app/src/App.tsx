import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import Landing from "./pages/Landing";
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

const shell = (el: JSX.Element) => <AppShell>{el}</AppShell>;

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/customer" element={shell(<CustomerHome />)} />
      <Route path="/customer/shop" element={shell(<Shop />)} />
      <Route path="/customer/wallet" element={shell(<WalletPage />)} />
      <Route path="/customer/history" element={shell(<Bills />)} />
      <Route path="/customer/help" element={shell(<Help />)} />
      <Route path="/rider" element={shell(<RiderRound />)} />
      <Route path="/rider/summary" element={shell(<RiderSummary />)} />
      <Route path="/admin" element={shell(<AdminOverview />)} />
      <Route path="/admin/routes" element={shell(<LiveRoutes />)} />
      <Route path="/admin/tickets" element={shell(<Tickets />)} />
      <Route path="/admin/customers" element={shell(<Customers />)} />
      <Route path="/admin/quality" element={shell(<Quality />)} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
