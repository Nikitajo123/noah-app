import { NavLink, Outlet } from "react-router-dom";

const tabClass = ({ isActive }: { isActive: boolean }) => (isActive ? "tab active" : "tab");

export default function Layout() {
  return (
    <div className="shell">
      <main className="shell-main">
        <Outlet />
      </main>
      <nav className="tabs">
        <NavLink to="/" end className={tabClass}>
          <i />
          Nalogi
        </NavLink>
        <NavLink to="/porocilo" className={tabClass}>
          <i />
          Poročilo
        </NavLink>
        <NavLink to="/profil" className={tabClass}>
          <i />
          Profil
        </NavLink>
      </nav>
    </div>
  );
}