import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import Login from "./pages/Login";
import Home from "./pages/Home";

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="page center">Nalaganje...</div>;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/*" element={user ? <Home /> : <Navigate to="/login" replace />} />
    </Routes>
  );
}