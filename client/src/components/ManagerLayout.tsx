import { NavLink, Outlet, useLocation } from "react-router-dom";
import { IconManage, IconOverview, IconProjects, IconReport, IconUser } from "./Icons";

const cls = ({ isActive }: { isActive: boolean }) => (isActive ? "mtab active" : "mtab");

export default function ManagerLayout() {
  const { pathname } = useLocation();
  return (
    <div className="mshell">
      <aside className="mside">
        <div className="mlogo">
          <img src="/noah-logo-light.png" alt="NOAH Houses" />
        </div>
        <nav>
          <NavLink to="/" end className={cls}>
            <span className="ic"><IconOverview /></span>
            Pregled
          </NavLink>
          <NavLink to="/porocila" className={cls}>
            <span className="ic"><IconReport /></span>
            Poročila
          </NavLink>
          <NavLink to="/projekti" className={cls}>
            <span className="ic"><IconProjects /></span>
            Projekti
          </NavLink>
          <NavLink to="/upravljanje" className={cls}>
            <span className="ic"><IconManage /></span>
            Upravljanje
          </NavLink>
          <NavLink to="/profil" className={cls}>
            <span className="ic"><IconUser /></span>
            Profil
          </NavLink>
        </nav>
      </aside>
      <main key={pathname} className="mmain page-in">
        <Outlet />
      </main>
    </div>
  );
}