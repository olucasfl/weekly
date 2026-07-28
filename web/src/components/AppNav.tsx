import { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { CalendarDays, CheckSquare, Calendar, BarChart2, User } from 'lucide-react';
import { LogoFull } from './Logo';

const tabs = [
  { to: '/', Icon: CalendarDays, label: 'Semana' },
  { to: '/rotinas', Icon: CheckSquare, label: 'Rotinas' },
  { to: '/eventos', Icon: Calendar, label: 'Eventos' },
  { to: '/progresso', Icon: BarChart2, label: 'Progresso' },
  { to: '/perfil', Icon: User, label: 'Perfil' },
];

// Renders both the mobile bottom tab bar and the tablet/desktop sidebar — CSS decides
// which one is visible at the current viewport width (see .bottom-nav / .sidebar in
// index.css), so callers don't need to know which layout is active.
export function AppNav() {
  useEffect(() => {
    // Marks the page as "has navigation" so .app-shell knows to reserve room for the
    // sidebar at desktop widths — only screens that render AppNav get that treatment,
    // so unauthenticated screens (auth, verify-email…) stay centered edge to edge.
    document.body.classList.add('has-app-nav');
    return () => { document.body.classList.remove('has-app-nav'); };
  }, []);

  return (
    <>
      <nav className="bottom-nav">
        {tabs.map(({ to, Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <Icon size={20} strokeWidth={1.8} />
            {label}
          </NavLink>
        ))}
      </nav>

      <nav className="sidebar">
        <div className="sidebar-brand">
          <LogoFull iconSize={28} textSize="sm" />
        </div>
        <div className="sidebar-links">
          {tabs.map(({ to, Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <Icon size={19} strokeWidth={1.8} />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  );
}
