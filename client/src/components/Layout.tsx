import { NavLink, Outlet, useLocation } from "react-router-dom";
import { IconReport, IconTasks, IconUser } from "./Icons";

const tabClass = ({ isActive }: { isActive: boolean }) => (isActive ? "tab active" : "tab");

export default function Layout() {
  const { pathname } = useLocation();
  return (
    <div className="shell">
      <main key={pathname} className="shell-main page-in">
        <Outlet />
      </main>
      <nav className="tabs">
        <NavLink to="/" end className={tabClass}>
          <span className="ic"><IconTasks /></span>
          Nalogi
        </NavLink>
        <NavLink to="/porocilo" className={tabClass}>
          <span className="ic"><IconReport /></span>
          Poročilo
        </NavLink>
        <NavLink to="/profil" className={tabClass}>
          <span className="ic"><IconUser /></span>
          Profil
        </NavLink>
      </nav>
    </div>
  );
}