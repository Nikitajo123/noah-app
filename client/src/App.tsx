import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Orders from "./pages/Orders";
import OrderDetail from "./pages/OrderDetail";
import Profile from "./pages/Profile";
import Soon from "./pages/Soon";
import Report from "./pages/Report";

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="page center">Nalaganje...</div>;

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  const worker = user.role === "DELAVEC";
  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route element={<Layout />}>
        <Route path="/" element={worker ? <Orders /> : <Soon title="Pregled dela" />} />
        <Route
          path="/nalog/:id"
          element={worker ? <OrderDetail /> : <Soon title="Podrobnosti naloga" />}
        />
        <Route
          path="/porocilo"
          element={worker ? <Report /> : <Soon title="Poročila" />}
        />
        <Route path="/profil" element={<Profile />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}