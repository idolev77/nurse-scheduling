from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.database import engine, Base
from app.routers import auth, users, departments, constraints, leave_requests, schedules, shift_summary, swap_requests, notifications, shifts, fairness

# Create all tables
Base.metadata.create_all(bind=engine)


def _run_db_cleanup() -> None:
    """
    Drop deprecated columns and the nurse_shift_availability table.
    Uses IF EXISTS so this is safe to run on both fresh and existing DBs.
    """
    stmts = [
        # Remove the entire availability table (FK to shifts and users)
        "DROP TABLE IF EXISTS nurse_shift_availability CASCADE",
        # users
        "ALTER TABLE users DROP COLUMN IF EXISTS created_at",
        # departments
        "ALTER TABLE departments DROP COLUMN IF EXISTS created_at",
        # schedules
        "ALTER TABLE schedules DROP COLUMN IF EXISTS created_at",
        # shifts
        "ALTER TABLE shifts DROP COLUMN IF EXISTS created_at",
        # shift_constraints
        "ALTER TABLE shift_constraints DROP COLUMN IF EXISTS note",
        "ALTER TABLE shift_constraints DROP COLUMN IF EXISTS created_at",
        # leave_requests  (reviewed_by has a FK – DROP COLUMN handles it automatically)
        "ALTER TABLE leave_requests DROP COLUMN IF EXISTS reviewed_by",
        "ALTER TABLE leave_requests DROP COLUMN IF EXISTS created_at",
        # swap_requests
        "ALTER TABLE swap_requests DROP COLUMN IF EXISTS resolved_at",
    ]
    with engine.begin() as conn:
        for stmt in stmts:
            conn.execute(text(stmt))


_run_db_cleanup()

app = FastAPI(
    title="Smart Nurse Scheduling System",
    description="A system for optimizing nurse shift scheduling in medical departments",
    version="1.0.0",
)

# CORS – allow React dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(departments.router)
app.include_router(constraints.router)
app.include_router(leave_requests.router)
app.include_router(schedules.router)
app.include_router(shift_summary.router)
app.include_router(swap_requests.router)
app.include_router(notifications.router)
app.include_router(shifts.router)
app.include_router(fairness.router)


@app.get("/")
def root():
    return {"message": "Smart Nurse Scheduling System API", "docs": "/docs"}
