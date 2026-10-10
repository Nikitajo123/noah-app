import { NavLink, Outlet } from "react-router-dom";

const cls = ({ isActive }: { isActive: boolean }) => (isActive ? "mtab active" : "mtab");

export default function ManagerLayout() {
  return (
    <div className="mshell">
      <aside className="mside">
        <div className="mlogo">NOAH</div>
        <nav>
          <NavLink to="/" end className={cls}>
            <i />
            Pregled
          </NavLink>
          <NavLink to="/projekti" className={cls}>
            <i />
            Projekti
          </NavLink>
          <NavLink to="/profil" className={cls}>
            <i />
            Profil
          </NavLink>
        </nav>
      </aside>
      <main className="mmain">
        <Outlet />
      </main>
    </div>
  );
}