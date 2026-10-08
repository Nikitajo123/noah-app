import { useAuth } from "../auth";

export default function Home() {
  const { user, logout } = useAuth();
  return (
    <div className="page">
      <h2>Pozdravljen, {user!.name}</h2>
      <p className="muted">
        Vloga: {user!.role === "VODJA" ? "vodja" : "delavec"}
      </p>
      <button className="btn-secondary" onClick={logout}>
        Odjava
      </button>
    </div>
  );
}