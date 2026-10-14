import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import Layout from "./components/Layout";
import ManagerLayout from "./components/ManagerLayout";
import Login from "./pages/Login";
import Orders from "./pages/Orders";
import OrderDetail from "./pages/OrderDetail";
import Report from "./pages/Report";
import Profile from "./pages/Profile";
import ManagerOverview from "./pages/ManagerOverview";
import ManagerOrder from "./pages/ManagerOrder";
import ProjectsList from "./pages/ProjectsList";
import Admin from "./pages/Admin";
import Reports from "./pages/Reports";
import { Spinner } from "./components/States";

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  if (user.role === "VODJA") {
    return (
      <Routes>
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route element={<ManagerLayout />}>
          <Route path="/" element={<ManagerOverview />} />
          <Route path="/nalog/:id" element={<ManagerOrder />} />
          <Route path="/porocila" element={<Reports />} />
          <Route path="/projekti" element={<ProjectsList />} />
          <Route path="/upravljanje" element={<Admin />} />
          <Route path="/profil" element={<Profile />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Orders />} />
        <Route path="/nalog/:id" element={<OrderDetail />} />
        <Route path="/porocilo" element={<Report />} />
        <Route path="/profil" element={<Profile />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}