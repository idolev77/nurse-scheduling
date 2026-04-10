# Smart Scheduling System for Nurses

A full-stack web application that streamlines and optimizes nurse shift scheduling in medical departments. A smart greedy algorithm assigns nurses to shifts while respecting hard constraints, personal preferences, leave requests, rest rules, and minimum staffing requirements.

## Project Team
- **Ido Levy**
- **Nereya Mantzur**

---

## Architecture

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, React Router 6, Tailwind CSS, Vite, Recharts |
| **Backend** | Python 3.12, FastAPI, SQLAlchemy 2 |
| **Database** | PostgreSQL (Neon.tech cloud) / SQLite (local dev) |
| **Auth** | JWT — HS256 via `python-jose`, bcrypt via `passlib` |
| **Deployment** | Docker, Docker Compose, Nginx (reverse proxy + SPA serving) |

---

## Quick Start

### Docker (recommended)

```bash
docker compose up --build
```

| Service | URL |
|---------|-----|
| Frontend (Nginx) | http://localhost:3000 |
| Backend (FastAPI) | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |

The frontend container waits for the backend health check to pass before starting.

### Manual Setup

#### Backend

```bash
cd backend
pip install -r requirements.txt
```

Create `backend/.env`: 
```env
DATABASE_URL=sqlite:///./nurse_scheduling.db
SECRET_KEY=your-secret-key-here
ACCESS_TOKEN_EXPIRE_MINUTES=480
```

For PostgreSQL:
```env
DATABASE_URL=postgresql://user:password@host:5432/dbname
```

```bash
uvicorn app.main:app --reload
```

#### Frontend

```bash
cd frontend
npm install
npm run dev        # http://localhost:3000
```

---

## Roles & Permissions

| Role | Permissions |
|------|-------------|
| `nurse` | View own schedule, submit constraints & leave requests, view shift hours summary |
| `head_nurse` | All nurse permissions + generate/publish schedules, review leave requests, manage users |
| `admin` | Full access including user management and department configuration |

---

## Features

### For All Staff
- **Dashboard** — Personalized greeting, quick-access navigation cards filtered by role
- **View Schedule** — Weekly calendar with `< / >` navigation; today's column highlighted; personal shifts marked with a blue ring
- **My Constraints** — Submit shift preferences (`Cannot Work`, `Prefer Not`, `Prefer`) by date and shift type, with optional notes; manage and delete them
- **Leave Requests** — Submit date-range leave requests with a reason; track approval status
- **Shift Hours Summary** — Personal monthly analytics dashboard (see details below)

### For Head Nurses & Admins
- **Manage Schedule** — Department + week selector; generate weekly schedules via algorithm; preview drafts before publishing
- **Manage Users** — Inline role changes, department assignments, active/inactive toggling; modal form to add new users
- **Review Leave Requests** — Approve or reject leave requests submitted by nurses

### Shift Hours Summary Widget

Accessible from the dashboard card → `/shift-summary`. Fetches `GET /api/shift-summary/me`.

| Section | Contents |
|---------|----------|
| Header | Month label, vs-last-month trend badge (↑/↓/—) |
| Leave notice | Banner shown when approved leave exists: days deducted and effective quota |
| Key metrics | Hours worked, hours remaining, shifts this month, avg hours per shift |
| Donut chart | Completion % of effective monthly quota |
| Bar chart | Weekly distribution of worked hours (Week 1–5) |
| Shift breakdown | Morning / Afternoon / Night — count, hours, %, mini progress bar, "Top" badge |
| Smart footer | Avg per shift, most frequent shift type, comparison to previous month |

---

## Scheduling Algorithm

Located in `backend/app/scheduler.py` — **Min-Cost Max-Flow** wrapped in an **Iterative Optimisation** loop with **hard-constraint repair**:

### Overview

1. Load all active `NURSE`-role users in the target department.
2. Build **static hard blocks** — `CANNOT_WORK` constraints + days covered by **approved leave requests** → `(nurse_id, date, shift_type)` set.
3. Build **availability edges** — every nurse × every shift, with cost derived from preference level (`PREFER` → cost 0, default → cost 1, `PREFER_NOT` → cost 2).
4. Run **50 Monte Carlo iterations** with shuffled inputs; for each:
   a. Lightly randomise edge order and stochastically drop some `PREFER_NOT` edges to explore alternative solutions.
   b. Call `_solve_with_constraints` (see below).
   c. Score the candidate with `evaluate_schedule` (quota fill, preference bonuses, utilisation-variance penalty).
5. Persist the **highest-scoring** feasible schedule to the database.

### Hard-Constraint Repair Loop (`_solve_with_constraints`)

Because a flow algorithm solves the entire graph simultaneously, inter-shift constraints (e.g. "no morning after night") cannot be encoded as simple edge costs. Instead, the solver uses an **iterative repair** approach (up to 10 rounds per iteration):

```
Solve flow network
       ↓
Detect constraint violations in result
       ↓  violations found?
  YES → add violating (nurse, date, shift) to hard_blocks → repeat
  NO  → return feasible candidate
```

### Hard Constraints enforced (`_detect_constraint_violations`)

| # | Rule | Enforcement |
|---|------|-------------|
| 1 | **24 h rest after Night** | Night on day D → block Morning & Afternoon on D+1 |
| 2 | **8 h rest after Afternoon** | Afternoon on day D → block Morning on D+1 |
| 3 | **Max 6 consecutive work-days** | 7th+ consecutive day → all shift types blocked |
| 4 | **Max 2 night shifts per week** | 3rd+ night in the 7-day window → blocked |
| 5 | **Max 2 consecutive night shifts** | 3rd+ consecutive night → blocked |

### Scoring (`evaluate_schedule`)

| Component | Weight |
|-----------|--------|
| Filled slot bonus | +100 per slot |
| Unfilled slot penalty | −200 per slot |
| Preferred assignment bonus | +10 per `PREFER` match |
| Utilisation-variance penalty | −50 × variance |

---

## API Reference

### Auth — `/api/auth`
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | — | Register a new user (201) |
| POST | `/api/auth/login` | OAuth2 form | Returns JWT `access_token` |
| GET | `/api/auth/me` | Bearer | Returns current user |

### Users — `/api/users`
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/users/` | head_nurse / admin | List all users; `?department_id=` filter |
| POST | `/api/users/` | head_nurse / admin | Create user (admin-side) |
| GET | `/api/users/{id}` | Any | Get single user |
| PUT | `/api/users/{id}` | head_nurse / admin | Partial update (role, department, active) |

### Departments — `/api/departments`
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/departments/` | — | List all departments |
| POST | `/api/departments/` | admin | Create department |
| PUT | `/api/departments/{id}` | admin | Update department |

### Constraints — `/api/constraints`
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/constraints/` | Any | Own constraints (nurses) or all with `?nurse_id=` (managers) |
| POST | `/api/constraints/` | Any | Create a constraint |
| DELETE | `/api/constraints/{id}` | Any | Delete own constraint |

### Leave Requests — `/api/leave-requests`
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/leave-requests/` | Any | Own requests (nurses) or all with `?status=` (managers) |
| POST | `/api/leave-requests/` | Any | Submit a leave request |
| PUT | `/api/leave-requests/{id}/review` | head_nurse / admin | Approve or reject |

### Schedules — `/api/schedules`
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/schedules/` | Any | List schedules; `?department_id=`; nurses see published only |
| GET | `/api/schedules/{id}` | Any | Get single schedule |
| POST | `/api/schedules/generate` | head_nurse / admin | Auto-generate weekly schedule |
| PUT | `/api/schedules/{id}/publish` | head_nurse / admin | Publish a draft schedule |

### Shift Summary — `/api/shift-summary`
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/shift-summary/me` | Any | Monthly summary for current user; `?year=&month=` (default: current month) |

**Example response:**
```json
{
  "year": 2026, "month": 4,
  "monthly_quota": 160,
  "effective_quota": 136,
  "leave_days": 3, "leave_hours": 24,
  "total_hours": 80, "hours_remaining": 56,
  "completion_pct": 58.8,
  "shifts_count": 10, "avg_hours_per_shift": 8.0,
  "most_frequent_shift": "morning",
  "shift_breakdown": {
    "morning":   { "count": 6, "hours": 48 },
    "afternoon": { "count": 3, "hours": 24 },
    "night":     { "count": 1, "hours": 8 }
  },
  "weekly_distribution": [
    { "week": 1, "label": "Week 1", "hours": 24 },
    { "week": 2, "label": "Week 2", "hours": 16 },
    { "week": 3, "label": "Week 3", "hours": 24 },
    { "week": 4, "label": "Week 4", "hours": 16 }
  ],
  "prev_month_comparison": {
    "prev_total_hours": 96,
    "prev_effective_quota": 160,
    "change_hours": -16,
    "change_pct": -16.7
  }
}
```

---

## Project Structure

```
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py          # FastAPI app, CORS, router registration
│       ├── config.py        # Environment variables (DATABASE_URL, SECRET_KEY, etc.)
│       ├── database.py      # SQLAlchemy engine, SessionLocal, Base, get_db()
│       ├── models.py        # ORM models: User, Department, Schedule, ShiftAssignment,
│       │                    #             ShiftConstraint, LeaveRequest + enums
│       ├── schemas.py       # Pydantic request/response schemas
│       ├── auth.py          # JWT creation/verification, bcrypt, FastAPI dependencies
│       ├── scheduler.py     # Greedy schedule generation algorithm
│       └── routers/
│           ├── auth.py
│           ├── users.py
│           ├── departments.py
│           ├── constraints.py
│           ├── leave_requests.py
│           ├── schedules.py
│           └── shift_summary.py
└── frontend/
    ├── Dockerfile
    ├── nginx.conf           # SPA fallback + /api reverse proxy + static caching
    ├── vite.config.js
    ├── tailwind.config.js
    ├── package.json
    └── src/
        ├── api.js           # Axios instance, JWT interceptor, 401 auto-logout
        ├── App.jsx          # Route definitions + PrivateRoute / ManagerRoute guards
        ├── main.jsx
        ├── index.css        # Tailwind + custom component classes
        ├── context/
        │   └── AuthContext.jsx
        ├── components/
        │   ├── Navbar.jsx
        │   └── ShiftHoursSummary.jsx
        └── pages/
            ├── Login.jsx
            ├── Register.jsx
            ├── Dashboard.jsx
            ├── ScheduleView.jsx
            ├── Constraints.jsx
            ├── LeaveRequests.jsx
            ├── ManageSchedule.jsx
            ├── ManageUsers.jsx
            └── ShiftHoursSummaryPage.jsx
```

---

## Database Models

| Model | Table | Notable Fields |
|-------|-------|---------------|
| `User` | `users` | `email`, `hashed_password`, `first_name`, `last_name`, `role`, `department_id`, `is_active` |
| `Department` | `departments` | `name`, `min_nurses_morning/afternoon/night` |
| `Schedule` | `schedules` | `department_id`, `week_start_date`, `is_published` |
| `ShiftAssignment` | `shift_assignments` | `schedule_id`, `nurse_id`, `date`, `shift_type` |
| `ShiftConstraint` | `shift_constraints` | `nurse_id`, `date`, `shift_type`, `constraint_type`, `note` |
| `LeaveRequest` | `leave_requests` | `nurse_id`, `start_date`, `end_date`, `reason`, `status`, `reviewed_by` |

**Shift types:** `morning` (07–15), `afternoon` (15–23), `night` (23–07)  
**Constraint types:** `cannot_work`, `prefer_not`, `prefer`  
**Leave/request statuses:** `pending`, `approved`, `rejected`


## Quick Start

### Docker (recommended)

```bash
docker compose up --build
```

The app will be available at `http://localhost:80`.

### Manual Setup

#### Backend

```bash
cd backend
pip install -r requirements.txt
```

Create a `.env` file in the `backend/` folder:
```env
DATABASE_URL=sqlite:///./nurse_scheduling.db
SECRET_KEY=your-secret-key-here
ACCESS_TOKEN_EXPIRE_MINUTES=480
```

Start the server:
```bash
uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000` with automatic docs at `http://localhost:8000/docs`.

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

The app will open at `http://localhost:5173`.

---

## Features

### For Nurses
- **View Schedule** – Interactive weekly calendar showing shift assignments
- **Submit Constraints** – Mark dates/shifts as "Cannot Work", "Prefer Not", or "Prefer"
- **Leave Requests** – Submit time-off requests with date range and reason
- **Shift Hours Summary** – Personal monthly dashboard with:
  - Total hours worked vs. effective monthly quota
  - Quota automatically adjusted for approved leave days
  - Donut chart showing completion percentage
  - Bar chart showing weekly hours distribution
  - Shift-type breakdown (Morning / Afternoon / Night)
  - Smart statistics: average hours per shift, most frequent shift type, comparison to previous month

### For Head Nurses / Admins
- **Generate Schedule** – Smart algorithm auto-generates weekly schedules considering:
  - Hard constraints (cannot work, approved leave)
  - Labour-law rest rules (24 h after night, 8 h after afternoon, max 6 consecutive days, max 2 nights/week, max 2 consecutive nights)
  - Soft preferences (prefer / prefer not)
  - Workload balancing across nurses
  - Minimum staffing requirements per shift
- **Publish Schedule** – Review drafts before publishing to nurses
- **Manage Users** – Assign roles, departments, activate/deactivate accounts
- **Review Leave Requests** – Approve or reject time-off requests

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login (returns JWT) |
| GET | `/api/auth/me` | Get current user |
| GET | `/api/users/` | List users (managers) |
| PUT | `/api/users/{id}` | Update user (admin) |
| GET/POST | `/api/departments/` | List/create departments |
| GET/POST | `/api/constraints/` | List/create shift constraints |
| DELETE | `/api/constraints/{id}` | Delete constraint |
| GET/POST | `/api/leave-requests/` | List/create leave requests |
| PUT | `/api/leave-requests/{id}/review` | Approve/reject leave |
| GET | `/api/schedules/` | List schedules |
| POST | `/api/schedules/generate` | Generate schedule |
| PUT | `/api/schedules/{id}/publish` | Publish schedule |
| GET | `/api/shift-summary/me` | Monthly shift-hours summary for current user |

### Shift Summary Response (`GET /api/shift-summary/me`)

```json
{
  "year": 2026,
  "month": 4,
  "monthly_quota": 160,
  "effective_quota": 136,
  "leave_days": 3,
  "leave_hours": 24,
  "total_hours": 80,
  "hours_remaining": 56,
  "completion_pct": 58.8,
  "shifts_count": 10,
  "avg_hours_per_shift": 8.0,
  "most_frequent_shift": "morning",
  "shift_breakdown": {
    "morning":   { "count": 6, "hours": 48 },
    "afternoon": { "count": 3, "hours": 24 },
    "night":     { "count": 1, "hours": 8  }
  },
  "weekly_distribution": [
    { "week": 1, "label": "Week 1", "hours": 24 },
    { "week": 2, "label": "Week 2", "hours": 16 }
  ],
  "prev_month_comparison": {
    "prev_total_hours": 96,
    "prev_effective_quota": 160,
    "change_hours": -16,
    "change_pct": -16.7
  }
}
```

Optional query params: `?year=2026&month=3`

---

## Scheduling Algorithm

The system uses a **greedy constraint-satisfaction** approach:

1. Collects all **hard constraints** (cannot work + approved leave days)
2. Collects **soft constraints** (preferences with weighted scores)
3. For each day × shift combination:
   - Filters out blocked nurses
   - Enforces rest rules (no morning shift after a night shift)
   - Prevents double-shifts on the same day
   - Scores candidates: `preference_score - (workload × 3)`
   - Assigns top-scoring nurses up to the minimum staffing requirement

This ensures fair distribution while respecting both mandatory and preferred constraints.

---

## Database Configuration

To connect to an external database (e.g., PostgreSQL), update the `DATABASE_URL` in `.env`:

```env
DATABASE_URL=postgresql://user:password@host:5432/dbname
```

---

## Roles

| Role | Permissions |
|------|------------|
| `nurse` | View own schedule, submit constraints & leave requests |
| `head_nurse` | All nurse permissions + generate/publish schedules, review leave, view all users |
| `admin` | Full system access including user management |
