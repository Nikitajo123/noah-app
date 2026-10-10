import { useAuth } from "../auth";

export default function Profile() {
  const { user, logout } = useAuth();
  return (
    <div className="page">
      <h2>{user!.name}</h2>
      <p className="muted">
        {user!.email}, {user!.role === "VODJA" ? "vodja" : "delavec"}
      </p>
      <button className="btn-secondary" onClick={logout}>
        Odjava
      </button>
    </div>
  );
}