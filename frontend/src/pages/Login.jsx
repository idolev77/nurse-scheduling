import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiMail, FiLock, FiArrowRight, FiCalendar, FiAlertCircle } from 'react-icons/fi';

const HERO_STATS = [
  { value: '3',   label: 'Shift Types' },
  { value: 'AI',  label: 'Smart Scheduler' },
  { value: '24/7', label: 'Coverage' },
];

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
                  type="password" required
                  className="field pl-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading
                ? <><span className="animate-pulse">Signing in...</span></>
                : <>Sign In <FiArrowRight size={15} /></>}
            </button>
          </form>

          <p className="mt-7 text-center text-sm text-slate-500">
            Don’t have an account?{' '}
            <Link to="/register" className="text-blue-600 font-semibold hover:underline">
              Create account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
