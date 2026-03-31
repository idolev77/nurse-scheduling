import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiUser, FiMail, FiLock, FiArrowRight, FiCalendar, FiAlertCircle, FiShield } from 'react-icons/fi';

export default function Register() {
  const { register, user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', first_name: '', last_name: '', role: 'nurse' });
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
      await register(form);
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  return (
    <div className="min-h-screen flex" style={{ marginTop: 0 }}>
      {/* ── Left hero panel ──────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-[52%] flex-col items-center justify-center p-14 relative overflow-hidden"
        style={{ background: 'linear-gradient(140deg, #0f172a 0%, #1e3a8a 50%, #0e7490 100%)' }}
      >
        <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-blue-500 opacity-[0.07] blur-3xl" />
        <div className="absolute -bottom-20 -right-20 w-96 h-96 rounded-full bg-cyan-400 opacity-[0.09] blur-3xl" />

        <div className="relative z-10 max-w-md text-white">
          <div className="flex items-center gap-3 mb-10">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.15)' }}
            >
              <FiCalendar size={24} className="text-white" />
            </div>
            <span className="text-xl font-bold">NurseScheduler</span>
          </div>
          <h1 className="text-4xl font-extrabold leading-tight mb-4">
            Join Your<br />
            <span style={{ color: '#38bdf8' }}>Healthcare Team</span>
          </h1>
          <p className="text-slate-300 text-base leading-relaxed mb-10">
            Create your account to start submitting shift preferences,
            requesting leave, and viewing your schedule.
          </p>
          <ul className="space-y-3">
            {[
              'View your published shift schedule',
              'Submit availability constraints',
              'Request and track leave',
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
          <div className="lg:hidden flex items-center gap-2 mb-8 text-slate-800">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #2563eb, #0891b2)' }}
            >
              <FiCalendar size={15} className="text-white" />
            </div>
            <span className="font-bold text-[15px]">NurseScheduler</span>
          </div>

          <h2 className="text-[28px] font-extrabold text-slate-900 mb-1 tracking-tight">Create account</h2>
          <p className="text-slate-500 text-sm mb-8">Fill in your details to get started</p>

          {error && (
            <div className="alert-error">
              <FiAlertCircle size={16} className="flex-shrink-0" /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">First Name</label>
                <div className="relative">
                  <FiUser className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                  <input required className="field pl-9" placeholder="Jane" value={form.first_name} onChange={update('first_name')} />
                </div>
              </div>
              <div>
                <label className="form-label">Last Name</label>
                <input required className="field" placeholder="Doe" value={form.last_name} onChange={update('last_name')} />
              </div>
            </div>

            <div>
              <label className="form-label">Email address</label>
              <div className="relative">
                <FiMail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input type="email" required className="field pl-10" placeholder="you@hospital.com" value={form.email} onChange={update('email')} />
              </div>
            </div>

            <div>
              <label className="form-label">Password</label>
              <div className="relative">
                <FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input type="password" required minLength={6} className="field pl-10" placeholder="Min. 6 characters" value={form.password} onChange={update('password')} />
              </div>
            </div>

            <div>
              <label className="form-label">Role</label>
              <div className="relative">
                <FiShield className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <select className="field pl-10 appearance-none cursor-pointer" value={form.role} onChange={update('role')}>
                  <option value="nurse">Nurse</option>
                  <option value="head_nurse">Head Nurse</option>
                </select>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading
              ? <span className="animate-pulse">Creating account...</span>
                : <>Create Account <FiArrowRight size={15} /></>}
            </button>
          </form>

          <p className="mt-7 text-center text-sm text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-600 font-semibold hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
