# Smart Scheduling System for Nurses

A full-stack web application that streamlines and optimizes nurse shift scheduling in medical departments. A Min-Cost Max-Flow algorithm assigns nurses to shifts while respecting hard constraints, personal preferences, leave requests, rest rules, and minimum staffing requirements.

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
npm run dev        # http://localhost:5173
```

---

## Roles & Permissions

| Role | Permissions |
|------|-------------|
| `nurse` | View own schedule, submit constraints & leave requests, swap shifts, view shift hours summary |
| `head_nurse` | All nurse permissions + generate/publish schedules, review leave requests, manage users |
| `admin` | Full access including user management and department configuration |

---

## Features

### For All Staff
- **Dashboard** — Personalized greeting, quick-access navigation cards filtered by role
- **View Schedule** — Weekly calendar with `< / >` navigation; today's column highlighted; personal shifts marked with a blue ring
- **My Constraints** — Submit shift preferences (`Cannot Work`, `Prefer Not`, `Prefer`) by date and shift type; manage and delete them
- **Leave Requests** — Submit date-range leave requests with a reason; track approval status
- **Shift Swap Marketplace** — Offer your own shift for swap or claim an open offer from a colleague; instant transfer with automatic notifications
- **Notifications** — Bell icon in the navbar shows unread notifications (swap confirmations, leave approvals, etc.); auto-polled every 30 s
- **Shift Hours Summary** — Personal monthly analytics dashboard (see details below)

### For Head Nurses & Admins
- **Manage Schedule** — Department + week selector; prepare shift slots; generate weekly schedules via algorithm; preview drafts before publishing
- **Manage Users** — Inline role changes, department assignments, employment-percentage and active/inactive toggling; modal form to add new users
- **Review Leave Requests** — Approve or reject leave requests submitted by nurses
- **All Constraints** — Department-wide view of every nurse's submitted shift preferences
- **Fairness Dashboard** — Weekend/night constraint-violation stats and per-nurse fatigue-index rankings (see Scheduling Algorithm below)

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

Located in `backend/app/scheduler.py` — **Min-Cost Max-Flow** wrapped in an **Iterative Optimisation** loop with **hard-constraint repair**, followed by a **fairness-aware Force-Assignment** pass that guarantees 100% shift coverage.

### Overview

**Phase 1 — Iterative MCMF**
1. Load all active `NURSE`-role users in the target department.
2. Build **hard blocks** — `CANNOT_WORK` constraints + days covered by **approved leave requests** → `(nurse_id, date, shift_type)` set. Leave-derived blocks are also tracked separately (`leave_blocks`) since they may never be overridden, even in Phase 2.
3. Build **availability edges** — every nurse × every shift, with cost derived from `ShiftConstraint` preference level (`PREFER` → cost 0, default → cost 1, `PREFER_NOT` → cost 2). A nurse who worked the previous Fri/Sat/Sun is soft-discouraged (bumped to cost 2) from this week's weekend shifts unless they explicitly `PREFER` it.
4. Run up to **50 iterations** with shuffled inputs, early-exiting after 10 iterations without a score improvement; for each:
   a. Lightly randomise edge order and stochastically drop ~10% of neutral edges to explore alternative solutions.
   b. Call `_solve_with_constraints` — a 4-layer flow network (`source → nurse → nurse_day → shift → sink`) that enforces one-shift-per-nurse-per-day at the network level (see below).
   c. Score the candidate with `evaluate_schedule` (quota fill, preference bonuses, utilisation-variance penalty, hard-violation safety-net penalty).
5. Keep the **highest-scoring** candidate across all iterations.

**Phase 2 — Fairness-Aware Force-Assignment (`_force_fill_shifts`)**

Any shift slot still under-staffed after Phase 1 is filled by picking, from a tiered eligibility list (ideal → relax weekly capacity → override `CANNOT_WORK` as a last resort), the available nurse with the **lowest `fatigue_index`** (see Fairness Engine below). Statutory rest rules and approved leave are **never** overridden in any tier — a slot that truly cannot be filled without breaking one is reported as a `CRITICAL` warning instead.

**Phase 3 — Persist**

The final schedule + assignments are saved as a draft (`is_published = false`). `NurseShiftStats` rows are only updated when the schedule is later **published** (`PUT /api/schedules/{id}/publish`), so regenerating an unpublished draft never inflates fairness counters.

### Fairness Engine (`NurseShiftStats` / fatigue index)

Each nurse has one `NurseShiftStats` row per calendar month, tracking `night_shifts_count`, `weekend_shifts_count`, `total_shifts_count`, and `forced_assignments_count`. The derived `fatigue_index` is:

```
fatigue_index = night_shifts_count   × 2.0
              + weekend_shifts_count × 1.5
              + forced_assignments   × 3.0
```

A lower fatigue index means the nurse should be preferred for the next difficult (night/weekend/force-fill) shift. Stats are inspectable and resettable via the [Fairness Analytics API](#fairness-analytics--apifairness) and the **Fairness Dashboard** page.

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
| Hard-constraint violation penalty | −10 000 per violation |

---

## API Reference

### Auth — `/api/auth`
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/login` | OAuth2 form | Returns JWT `access_token` |
| GET | `/api/auth/me` | Bearer | Returns current user |

New users are created by an admin via `POST /api/users/` — there is no public self-registration endpoint.

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

### Shifts — `/api/shifts`
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/shifts/generate-week` | head_nurse / admin | Create 21 shift slots for a 7-day week (idempotent) |
| GET | `/api/shifts/` | Any | List shifts; `?department_id=&week_start=` filters |
| PUT | `/api/shifts/{id}` | head_nurse / admin | Update `required_staff` for a specific shift slot |

### Swap Requests — `/api/swap-requests`
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/swap-requests` | Any | Offer a shift for swap |
| GET | `/api/swap-requests` | Any | List open swap offers (excludes own by default; `?include_mine=true` to include) |
| GET | `/api/swap-requests/mine` | Any | List the current user's own open offers |
| GET | `/api/swap-requests/count` | Any | Open, claimable swap count for the dashboard badge |
| POST | `/api/swap-requests/{id}/claim` | Any | Claim an open swap offer (instant transfer + notifications) |
| DELETE | `/api/swap-requests/{id}` | Any | Cancel own open offer |

### Notifications — `/api/notifications`
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/notifications` | Any | List last 50 notifications for current user |
| GET | `/api/notifications/unread-count` | Any | Returns `{ "count": N }` |
| POST | `/api/notifications/mark-all-read` | Any | Mark all notifications as read |

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

### Fairness Analytics — `/api/fairness`
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/fairness/shift-distribution` | head_nurse / admin | Weekend/night constraint-violation counts per nurse, with mean/std-dev/variance stats; `?department_id=&year=&month=` |
| GET | `/api/fairness/nurse-stats` | head_nurse / admin | All `NurseShiftStats` rows, sorted by `fatigue_index` descending; `?department_id=&year=&month=` |
| GET | `/api/fairness/nurse-stats/{nurse_id}` | Any (own) / manager (any) | Monthly fatigue-index history for one nurse |
| DELETE | `/api/fairness/nurse-stats/{nurse_id}` | admin | Reset a nurse's stats for a given `year`/`month` |

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
│       ├── models.py        # ORM models + enums (see Database Models below)
│       ├── schemas.py       # Pydantic request/response schemas
│       ├── auth.py          # JWT creation/verification, bcrypt, FastAPI dependencies
│       ├── scheduler.py     # Min-Cost Max-Flow schedule generation algorithm
│       └── routers/
│           ├── auth.py
│           ├── users.py
│           ├── departments.py
│           ├── constraints.py
│           ├── leave_requests.py
│           ├── schedules.py
│           ├── shifts.py
│           ├── swap_requests.py
│           ├── notifications.py
│           ├── shift_summary.py
│           └── fairness.py
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
        │   ├── Navbar.jsx          # Top nav; notification bell with unread badge
        │   └── ShiftHoursSummary.jsx
        └── pages/
            ├── Login.jsx
            ├── Register.jsx
            ├── Dashboard.jsx
            ├── ScheduleView.jsx
            ├── Constraints.jsx
            ├── AllConstraints.jsx
            ├── LeaveRequests.jsx
            ├── ManageSchedule.jsx
            ├── ManageUsers.jsx
            ├── ShiftHoursSummaryPage.jsx
            ├── SwapMarketplace.jsx
            └── FairnessDashboard.jsx
```

---

## Database Models

| Model | Table | Notable Fields |
|-------|-------|---------------|
| `User` | `users` | `email`, `hashed_password`, `first_name`, `last_name`, `role`, `department_id`, `employment_percentage`, `is_active` |
| `Department` | `departments` | `name`, `min_nurses_morning/afternoon/night` |
| `Schedule` | `schedules` | `department_id`, `week_start_date`, `is_published` |
| `ShiftAssignment` | `shift_assignments` | `schedule_id`, `nurse_id`, `date`, `shift_type` |
| `ShiftConstraint` | `shift_constraints` | `nurse_id`, `date`, `shift_type`, `constraint_type` |
| `LeaveRequest` | `leave_requests` | `nurse_id`, `start_date`, `end_date`, `reason`, `status` |
| `Shift` | `shifts` | `department_id`, `date`, `shift_type`, `required_staff` — unique per (dept, date, type) |
| `SwapRequest` | `swap_requests` | `shift_assignment_id`, `requester_id`, `claimant_id`, `status`, `note`, `created_at` |
| `Notification` | `notifications` | `user_id`, `message`, `is_read`, `created_at` |
| `NurseShiftStats` | `nurse_shift_stats` | `nurse_id`, `period_year`, `period_month`, `night_shifts_count`, `weekend_shifts_count`, `total_shifts_count`, `forced_assignments_count`, `fatigue_index` — unique per (nurse, year, month) |

**Shift types:** `morning` (07–15), `afternoon` (15–23), `night` (23–07)  
**Constraint types:** `cannot_work`, `prefer_not`, `prefer`  
**Leave / request statuses:** `pending`, `approved`, `rejected`  
**Swap request statuses:** `open`, `claimed`, `cancelled`
