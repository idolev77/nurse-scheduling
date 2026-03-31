# Smart Scheduling System for Nurses

A web-based system designed to streamline and optimize nurse scheduling in medical departments, using smart algorithms to handle constraints, personal preferences, and real-time staffing requirements.

## Project Team
- **Ido**
- **Nereya Mantzur**

---

## Architecture

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, Tailwind CSS, Vite |
| **Backend** | Python, FastAPI |
| **Database** | SQLAlchemy (SQLite / PostgreSQL) |
| **Auth** | JWT (JSON Web Tokens) |

---

## Quick Start

### 1. Backend Setup

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

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The app will open at `http://localhost:3000`.

---

## Features

### For Nurses
- **View Schedule** – Interactive weekly calendar showing shift assignments
- **Submit Constraints** – Mark dates/shifts as "Cannot Work", "Prefer Not", or "Prefer"
- **Leave Requests** – Submit time-off requests with date range and reason

### For Head Nurses / Admins
- **Generate Schedule** – Smart algorithm auto-generates weekly schedules considering:
  - Hard constraints (cannot work, approved leave)
  - Soft preferences (prefer / prefer not)
  - Workload balancing across nurses
  - Rest rules (no morning after night shift)
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
