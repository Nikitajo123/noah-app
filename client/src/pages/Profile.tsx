import { useAuth } from "../auth";
import { IconLogout } from "../components/Icons";

export default function Profile() {
  const { user, logout } = useAuth();
  const initials = user!.name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="page profile">
      <div className="profile-card">
        <span className="avatar" aria-hidden="true">
          {initials}
        </span>
        <h2>{user!.name}</h2>
        <p className="muted">
          {user!.email}, {user!.role === "VODJA" ? "vodja" : "delavec"}
        </p>
      </div>
      <button className="btn-secondary" onClick={logout}>
        <IconLogout size={20} />
        Odjava
      </button>
    </div>
  );
}
