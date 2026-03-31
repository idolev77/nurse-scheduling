import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiCalendar, FiLogOut, FiMenu, FiX, FiGrid, FiSliders, FiClock, FiSettings, FiUsers } from 'react-icons/fi';
import { useState } from 'react';

const NAV_LINKS = [
  { to: '/dashboard',       label: 'Dashboard',       icon: <FiGrid size={15} />,    manager: false },
  { to: '/schedule',        label: 'Schedule',         icon: <FiCalendar size={15} />, manager: false },
  { to: '/constraints',     label: 'Constraints',      icon: <FiSliders size={15} />,  manager: false },
  { to: '/leave-requests',  label: 'Leave Requests',   icon: <FiClock size={15} />,    manager: false },
  { to: '/manage/schedule', label: 'Manage Schedule',  icon: <FiSettings size={15} />, manager: true  },
  { to: '/manage/users',    label: 'Users',            icon: <FiUsers size={15} />,    manager: true  },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };
  const isManager = user && (user.role === 'head_nurse' || user.role === 'admin');
  const visibleLinks = NAV_LINKS.filter((l) => !l.manager || isManager);
  const isActive = (to) => location.pathname === to;

  const initials = user
    ? (user.first_name?.[0] ?? '') + (user.last_name?.[0] ?? '')
    : '';

  return (
    <nav
      style={{ background: 'rgba(15,23,42,0.97)', backdropFilter: 'blur(12px)' }}
      className="sticky top-0 z-50 text-white shadow-xl border-b border-white/10"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <Link to="/dashboard" className="flex items-center gap-2.5 select-none">
            <div
              className="flex items-center justify-center w-8 h-8 rounded-lg"
              style={{ background: 'linear-gradient(135deg, #2563eb, #0891b2)' }}
            >
              <FiCalendar size={16} className="text-white" />
            </div>
            <span className="font-bold text-[15px] tracking-tight">
              Nurse<span className="text-sky-400">Scheduler</span>
            </span>
          </Link>

          {user && (
            <>
              {/* Desktop nav */}
              <div className="hidden md:flex items-center gap-1">
                {visibleLinks.map((l) => (
                  <Link
                    key={l.to}
                    to={l.to}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-150
                      ${
                        isActive(l.to)
                          ? 'bg-white/15 text-white'
                          : 'text-slate-300 hover:text-white hover:bg-white/8'
                      }`}
                  >
                    {l.icon} {l.label}
                  </Link>
                ))}
              </div>

              {/* Right side: avatar + logout */}
              <div className="hidden md:flex items-center gap-3">
                <div className="flex items-center gap-2 pl-3 border-l border-white/15">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)' }}
                  >
                    {initials.toUpperCase()}
                  </div>
                  <div className="leading-tight">
                    <p className="text-[13px] font-semibold text-white">{user.first_name} {user.last_name}</p>
                    <p className="text-[11px] text-slate-400 capitalize">{user.role.replace('_', ' ')}</p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] text-slate-300 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-all duration-150"
                  title="Sign out"
                >
                  <FiLogOut size={15} /> Sign out
                </button>
              </div>

              {/* Mobile hamburger */}
              <button
                className="md:hidden p-2 rounded-lg hover:bg-white/10 transition"
                onClick={() => setOpen(!open)}
              >
                {open ? <FiX size={22} /> : <FiMenu size={22} />}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Mobile drawer */}
      {open && user && (
        <div className="md:hidden border-t border-white/10 px-4 pb-4 pt-3 flex flex-col gap-1 animate-fade-in">
          {visibleLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition
                ${
                  isActive(l.to)
                    ? 'bg-white/15 text-white'
                    : 'text-slate-300 hover:text-white hover:bg-white/8'
                }`}
            >
              {l.icon} {l.label}
            </Link>
          ))}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition mt-1"
          >
            <FiLogOut size={15} /> Sign out
          </button>
        </div>
      )}
    </nav>
  );
}
