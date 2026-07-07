import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import { FiMail, FiLock, FiArrowRight, FiCalendar, FiAlertCircle, FiEye, FiEyeOff, FiZap, FiX, FiUser, FiStar } from 'react-icons/fi';

const HERO_STATS = [
  { value: '3',   label: 'Shift Types' },
  { value: 'AI',  label: 'Smart Scheduler' },
  { value: '24/7', label: 'Coverage' },
];

const ROLE_LABELS = {
  head_nurse: 'אחות אחראית',
  admin: 'מנהל/ת',
  nurse: 'אחות',
};

export default function Login() {
  const { login, quickLogin, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // ── Quick (password-less) demo login ──
  const [pickerOpen, setPickerOpen] = useState(false);
  const [quickUsers, setQuickUsers] = useState([]);
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickError, setQuickError] = useState('');
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    if (user) navigate('/dashboard');
  }, [user, navigate]);

  if (user) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const openPicker = async () => {
    setPickerOpen(true);
    setQuickError('');
    if (quickUsers.length) return;
    setQuickLoading(true);
    try {
      const res = await api.get('/auth/quick-login-users');
      setQuickUsers(res.data);
    } catch (err) {
      setQuickError('טעינת המשתמשים נכשלה');
    } finally {
      setQuickLoading(false);
    }
  };

  const handleQuickLogin = async (userId) => {
    setBusyId(userId);
    setQuickError('');
    try {
      await quickLogin(userId);
      navigate('/dashboard');
    } catch (err) {
      setQuickError(err.response?.data?.detail || 'ההתחברות נכשלה');
      setBusyId(null);
    }
  };

  // Group by role for the picker: managers first, then nurses
  const grouped = ['head_nurse', 'admin', 'nurse'].map((role) => ({
    role,
    users: quickUsers.filter((u) => String(u.role).toLowerCase() === role),
  })).filter((g) => g.users.length);

  return (
    <div className="min-h-screen flex" style={{ marginTop: 0 }}>
      {/* ── Left hero panel ──────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-[52%] flex-col items-center justify-center p-14 relative overflow-hidden"
        style={{ background: 'linear-gradient(140deg, #0f172a 0%, #1e3a8a 50%, #0e7490 100%)' }}
      >
        {/* Decorative blobs */}
        <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-blue-500 opacity-[0.07] blur-3xl" />
        <div className="absolute -bottom-20 -right-20 w-96 h-96 rounded-full bg-cyan-400 opacity-[0.09] blur-3xl" />
        <div className="absolute top-1/3 left-1/4  w-48 h-48 rounded-full bg-indigo-400 opacity-[0.06] blur-2xl" />

        <div className="relative z-10 max-w-md text-white">
          {/* Logo mark */}
          <div className="flex items-center gap-3 mb-10">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg"
              style={{ background: 'rgba(255,255,255,0.15)' }}
            >
              <FiCalendar size={24} className="text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">NurseScheduler</span>
          </div>

          <h1 className="text-4xl font-extrabold leading-tight mb-4">
            Smart Nurse<br />
            <span style={{ color: '#38bdf8' }}>Scheduling System</span>
          </h1>
          <p className="text-slate-300 text-base leading-relaxed mb-10">
            Intelligent shift management powered by constraint-aware algorithms
            — designed for modern healthcare teams.
          </p>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4">
            {HERO_STATS.map((s) => (
              <div
                key={s.label}
                className="rounded-2xl p-4 text-center"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                <div className="text-2xl font-extrabold text-white">{s.value}</div>
                <div className="text-xs text-slate-400 mt-1 font-medium">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Feature bullets */}
          <ul className="mt-10 space-y-3">
            {[
              'Automated weekly schedule generation',
              'Hard & soft constraint satisfaction',
              'Workload balancing across nursing staff',
            ].map((text) => (
              <li key={text} className="flex items-center gap-3 text-sm text-slate-300">
                <span className="w-5 h-5 rounded-full bg-sky-500/20 border border-sky-400/30 flex items-center justify-center flex-shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── Right form panel ─────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50">
        <div className="w-full max-w-[400px] animate-fade-in-up">
          {/* Mobile brand */}
          <div className="lg:hidden flex items-center gap-2 mb-8 text-slate-800">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #2563eb, #0891b2)' }}
            >
              <FiCalendar size={15} className="text-white" />
            </div>
            <span className="font-bold text-[15px]">NurseScheduler</span>
          </div>

          <h2 className="text-[28px] font-extrabold text-slate-900 mb-1 tracking-tight">Welcome back</h2>
          <p className="text-slate-500 text-sm mb-8">Sign in to your account to continue</p>

          {error && (
            <div className="alert-error">
              <FiAlertCircle size={16} className="flex-shrink-0" /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="form-label">Email address</label>
              <div className="relative">
                <FiMail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="email" required
                  className="field pl-10"
                  placeholder="you@hospital.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="form-label">Password</label>
              <div className="relative">
                <FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type={showPassword ? 'text' : 'password'} required
                  className="field pl-10 pr-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading
                ? <><span className="animate-pulse">Signing in...</span></>
                : <>Sign In <FiArrowRight size={15} /></>}
            </button>
          </form>

          {/* ── Quick demo login (no password) ── */}
          <div className="flex items-center gap-3 my-6">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs text-slate-400 font-medium">או</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <button
            type="button"
            onClick={openPicker}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold text-sm hover:bg-slate-100 transition"
          >
            <FiZap size={15} className="text-amber-500" />
            כניסה מהירה (הדגמה) — בחירת משתמש ללא סיסמה
          </button>
        </div>
      </div>

      {/* ── Quick-login picker modal ── */}
      {pickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(15,23,42,0.55)' }}
          onClick={() => setPickerOpen(false)}
        >
          <div
            dir="rtl"
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">כניסה מהירה</h3>
                <p className="text-xs text-slate-500 mt-0.5">בחרו משתמש להתחברות ללא סיסמה</p>
              </div>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="text-slate-400 hover:text-slate-600"
                aria-label="סגירה"
              >
                <FiX size={20} />
              </button>
            </div>

            <div className="overflow-y-auto px-4 py-4 space-y-5">
              {quickError && (
                <div className="alert-error"><FiAlertCircle size={16} /> {quickError}</div>
              )}
              {quickLoading && (
                <div className="text-center text-slate-500 py-8 text-sm">טוען משתמשים…</div>
              )}
              {!quickLoading && grouped.map((group) => (
                <div key={group.role}>
                  <div className="flex items-center gap-2 mb-2 px-1">
                    {group.role === 'nurse'
                      ? <FiUser size={13} className="text-slate-400" />
                      : <FiStar size={13} className="text-amber-500" />}
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      {ROLE_LABELS[group.role] || group.role}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {group.users.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        disabled={busyId !== null}
                        onClick={() => handleQuickLogin(u.id)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition text-right disabled:opacity-50"
                      >
                        <span
                          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                          style={{ background: group.role === 'nurse' ? '#0891b2' : '#2563eb' }}
                        >
                          {u.first_name?.[0]}{u.last_name?.[0]}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block font-semibold text-slate-800 text-sm truncate">
                            {u.first_name} {u.last_name}
                          </span>
                          <span className="block text-xs text-slate-400 truncate">{u.email}</span>
                        </span>
                        {busyId === u.id
                          ? <span className="text-xs text-blue-600 animate-pulse">מתחבר…</span>
                          : <FiArrowRight size={15} className="text-slate-300 rotate-180" />}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {!quickLoading && !grouped.length && !quickError && (
                <div className="text-center text-slate-500 py-8 text-sm">לא נמצאו משתמשים</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
