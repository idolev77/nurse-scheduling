from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.routers import auth, users, departments, constraints, leave_requests, schedules

# Create all tables
Base.metadata.create_all(bind=engine)

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


@app.get("/")
def root():
    return {"message": "Smart Nurse Scheduling System API", "docs": "/docs"}
