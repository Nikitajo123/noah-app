import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth";
import { ROLE_LABEL } from "../format";
import { IconManage, IconOverview, IconProjects, IconReport, IconUser } from "./Icons";
import type { Role } from "../types";

const cls = ({ isActive }: { isActive: boolean }) => (isActive ? "mtab active" : "mtab");

type Item = { to: string; label: string; icon: React.ReactNode; roles: Role[]; end?: boolean };

const ALL: Role[] = ["VODJA", "VODJA_GRADBISC", "VODJA_DEL"];

const ITEMS: Item[] = [
  { to: "/", label: "Pregled", icon: <IconOverview />, roles: ALL, end: true },
  { to: "/porocila", label: "Poročila", icon: <IconReport />, roles: ALL },
  { to: "/gradbisca", label: "Gradbišča", icon: <IconProjects />, roles: ALL },
  { to: "/upravljanje", label: "Upravljanje", icon: <IconManage />, roles: ALL },
  { to: "/profil", label: "Profil", icon: <IconUser />, roles: ALL },
];

export default function ManagerLayout() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const role = user!.role;
  return (
    <div className="mshell">
      <aside className="mside">
        <div className="mlogo">
          <img src="/noah-logo-light.png" alt="NOAH Houses" />
          <span className="mrole">{ROLE_LABEL[role]}</span>
        </div>
        <nav>
          {ITEMS.filter((i) => i.roles.includes(role)).map((i) => (
            <NavLink key={i.to} to={i.to} end={i.end} className={cls}>
              <span className="ic">{i.icon}</span>
              {i.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main key={pathname} className="mmain page-in">
        <Outlet />
      </main>
    </div>
  );
}
