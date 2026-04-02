import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { FiCalendar, FiSliders, FiClock, FiUsers, FiSettings, FiArrowRight, FiActivity } from 'react-icons/fi';

const CARDS = [
  {
    to: '/schedule',
    icon: <FiCalendar size={22} />,
    title: 'View Schedule',
    description: 'See your upcoming shift assignments for the week',
    gradient: 'from-blue-500 to-cyan-500',
    manager: false,
  },
  {
    to: '/constraints',
    icon: <FiSliders size={22} />,
    title: 'My Constraints',
    description: 'Submit shift preferences and mark your unavailability',
    gradient: 'from-amber-500 to-orange-500',
    manager: false,
  },
  {
    to: '/leave-requests',
    icon: <FiClock size={22} />,
    title: 'Leave Requests',
    description: 'Request time off and track your approval status',
    gradient: 'from-emerald-500 to-teal-500',
    manager: false,
  },
  {
    to: '/shift-summary',
    icon: <FiActivity size={22} />,
    title: 'Shift Hours Summary',
    description: 'Monthly quota progress, shift breakdown, and smart statistics',
    gradient: 'from-sky-500 to-blue-600',
    manager: false,
  },
  {
    to: '/manage/schedule',
    icon: <FiSettings size={22} />,
    title: 'Manage Schedule',
    description: 'Generate and publish weekly schedules for your department',
    gradient: 'from-violet-500 to-purple-600',
    manager: true,
  },
  {
    to: '/manage/users',
    icon: <FiUsers size={22} />,
    title: 'Manage Users',
    description: 'Assign roles, departments, and manage staff accounts',
    gradient: 'from-indigo-500 to-blue-600',
    manager: true,
  },
];

export default function Dashboard() {
  const { user } = useAuth();
  const isManager = user && (user.role === 'head_nurse' || user.role === 'admin');
  const cards = CARDS.filter((c) => !c.manager || isManager);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div>
      {/* Hero greeting */}
      <div
        className="rounded-2xl p-8 mb-8 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #0e7490 100%)' }}
      >
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-cyan-400 opacity-10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-32 h-32 rounded-full bg-blue-400 opacity-10 blur-2xl" />
        <div className="relative z-10">
          <p className="text-sky-300 text-sm font-medium mb-1">{greeting()}</p>
          <h1 className="text-3xl font-extrabold text-white tracking-tight mb-1">
            {user?.first_name} {user?.last_name}
          </h1>
          <span
            className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold mt-2"
            style={{ background: 'rgba(255,255,255,0.12)', color: '#bae6fd' }}
          >
            {user?.role?.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
          </span>
        </div>
      </div>

      {/* Section label */}
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Quick Access</p>

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {cards.map((card, i) => (
          <Link
            key={card.to}
            to={card.to}
            className="card-hover p-6 group flex flex-col gap-4 animate-fade-in-up"
            style={{ animationDelay: `${i * 0.06}s`, opacity: 0, animationFillMode: 'forwards' }}
          >
            <div className="flex items-start justify-between">
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center text-white bg-gradient-to-br ${card.gradient} shadow-md`}
              >
                {card.icon}
              </div>
              <FiArrowRight
                size={16}
                className="text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all duration-200 mt-1"
              />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-[15px] mb-1">{card.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{card.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

