import { NavLink } from 'react-router-dom';
import { CheckSquare, Calendar, BarChart2, User } from 'lucide-react';
import { LogoMarkIcon } from './Logo';

const tabs = [
  { to: '/', Icon: LogoMarkIcon, label: 'Semana' },
  { to: '/afazeres', Icon: CheckSquare, label: 'Afazeres' },
  { to: '/eventos', Icon: Calendar, label: 'Eventos' },
  { to: '/progresso', Icon: BarChart2, label: 'Progresso' },
  { to: '/perfil', Icon: User, label: 'Perfil' },
];

export function BottomNav() {
  return (
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
  );
}
