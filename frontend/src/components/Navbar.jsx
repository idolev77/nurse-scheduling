import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiCalendar, FiLogOut, FiMenu, FiX, FiGrid, FiSliders, FiClock, FiSettings, FiUsers, FiRepeat, FiBell } from 'react-icons/fi';
import { useState, useEffect, useRef } from 'react';
import api from '../api';

const NAV_LINKS = [
  { to: '/dashboard',         label: 'Dashboard',        icon: <FiGrid size={15} />,    manager: false },
  { to: '/schedule',          label: 'Schedule',          icon: <FiCalendar size={15} />, manager: false },
  { to: '/constraints',       label: 'Constraints',       icon: <FiSliders size={15} />,      manager: false },
  { to: '/leave-requests',    label: 'Leave Requests',    icon: <FiClock size={15} />,    manager: false },
  { to: '/swap-marketplace',  label: 'Swap Marketplace',  icon: <FiRepeat size={15} />,   manager: false },
  { to: '/manage/schedule',   label: 'Manage Schedule',   icon: <FiSettings size={15} />, manager: true  },
  { to: '/manage/users',      label: 'Users',             icon: <FiUsers size={15} />,    manager: true  },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef(null);

  const handleLogout = () => { logout(); navigate('/login'); };
  const isManager = user && (user.role === 'head_nurse' || user.role === 'admin');
  const visibleLinks = NAV_LINKS.filter((l) => !l.manager || isManager);
  const isActive = (to) => location.pathname === to;

  const initials = user
    ? (user.first_name?.[0] ?? '') + (user.last_name?.[0] ?? '')
    : '';

  // Poll unread notification count every 30 s
  useEffect(() => {
    if (!user) return;
    const fetchCount = () => {
      api.get('/notifications/unread-count').then((res) => setUnreadCount(res.data.count)).catch(() => {});
    };
    fetchCount();
    const interval = setInterval(fetchCount, 30_000);
    return () => clearInterval(interval);
  }, [user]);

  // Load full notifications when bell is opened
  const openBell = () => {
    setBellOpen((prev) => !prev);
    if (!bellOpen) {
      api.get('/notifications').then((res) => setNotifications(res.data)).catch(() => {});
    }
  };

  // Mark all as read when dropdown closes
  useEffect(() => {
    if (!bellOpen && unreadCount > 0) {
      api.post('/notifications/mark-all-read').then(() => setUnreadCount(0)).catch(() => {});
    }
  }, [bellOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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

              {/* Right side: bell + avatar + logout */}
              <div className="hidden md:flex items-center gap-3">
                {/* Notification bell */}
                <div className="relative" ref={bellRef}>
                  <button
                    onClick={openBell}
                    className="relative flex items-center justify-center w-8 h-8 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition"
                    title="Notifications"
                  >
                    <FiBell size={17} />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 rounded-full bg-rose-500 text-[10px] font-bold text-white flex items-center justify-center border-2 border-[rgba(15,23,42,0.97)]">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>
                  {bellOpen && (
                    <div className="absolute right-0 top-10 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden">
                      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-800">Notifications</span>
                        {notifications.filter((n) => !n.is_read).length > 0 && (
                          <span className="text-xs text-rose-500 font-medium">
                            {notifications.filter((n) => !n.is_read).length} unread
                          </span>
                        )}
                      </div>
                      <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
                        {notifications.length === 0 ? (
                          <p className="text-sm text-slate-400 text-center py-8">No notifications yet</p>
                        ) : (
                          notifications.map((n) => (
                            <div
                              key={n.id}
                              className={`px-4 py-3 text-sm ${n.is_read ? 'text-slate-500' : 'text-slate-800 bg-sky-50/60'}`}
                            >
                              <p className="leading-snug">{n.message}</p>
                              <p className="text-[11px] text-slate-400 mt-1">
                                {new Date(n.created_at).toLocaleString('en-GB')}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

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
