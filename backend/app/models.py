import enum
from datetime import datetime, date
from sqlalchemy import (
    Column, Integer, String, Date, DateTime, Enum, ForeignKey, Boolean, Text, Time
)
from sqlalchemy.orm import relationship
from app.database import Base


class RoleEnum(str, enum.Enum):
    NURSE = "nurse"
    HEAD_NURSE = "head_nurse"
    ADMIN = "admin"


class ShiftType(str, enum.Enum):
    MORNING = "morning"      # 07:00 - 15:00
    AFTERNOON = "afternoon"  # 15:00 - 23:00
    NIGHT = "night"          # 23:00 - 07:00


class RequestStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class ConstraintType(str, enum.Enum):
    CANNOT_WORK = "cannot_work"
    PREFER_NOT = "prefer_not"
    PREFER = "prefer"


# ── Users ──────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    role = Column(Enum(RoleEnum), default=RoleEnum.NURSE, nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    department = relationship("Department", back_populates="nurses")
    constraints = relationship("ShiftConstraint", back_populates="nurse")
    leave_requests = relationship("LeaveRequest", back_populates="nurse", foreign_keys="LeaveRequest.nurse_id")
    shifts = relationship("ShiftAssignment", back_populates="nurse")


# ── Departments ────────────────────────────────────────
class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), unique=True, nullable=False)
    min_nurses_morning = Column(Integer, default=2)
    min_nurses_afternoon = Column(Integer, default=2)
    min_nurses_night = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)

    nurses = relationship("User", back_populates="department")
    schedules = relationship("Schedule", back_populates="department")


# ── Schedules ──────────────────────────────────────────
class Schedule(Base):
    __tablename__ = "schedules"

    id = Column(Integer, primary_key=True, index=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    week_start_date = Column(Date, nullable=False)
    is_published = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    department = relationship("Department", back_populates="schedules")
    assignments = relationship("ShiftAssignment", back_populates="schedule", cascade="all, delete-orphan")


# ── Shift Assignments ─────────────────────────────────
class ShiftAssignment(Base):
    __tablename__ = "shift_assignments"

    id = Column(Integer, primary_key=True, index=True)
    schedule_id = Column(Integer, ForeignKey("schedules.id"), nullable=False)
    nurse_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    date = Column(Date, nullable=False)
    shift_type = Column(Enum(ShiftType), nullable=False)

    schedule = relationship("Schedule", back_populates="assignments")
    nurse = relationship("User", back_populates="shifts")


# ── Shift Constraints (nurse preferences) ─────────────
class ShiftConstraint(Base):
    __tablename__ = "shift_constraints"

    id = Column(Integer, primary_key=True, index=True)
    nurse_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    date = Column(Date, nullable=False)
    shift_type = Column(Enum(ShiftType), nullable=False)
    constraint_type = Column(Enum(ConstraintType), nullable=False)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    nurse = relationship("User", back_populates="constraints")


# ── Leave Requests ─────────────────────────────────────
class LeaveRequest(Base):
    __tablename__ = "leave_requests"

    id = Column(Integer, primary_key=True, index=True)
    nurse_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    reason = Column(Text, nullable=True)
    status = Column(Enum(RequestStatus), default=RequestStatus.PENDING, nullable=False)
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    nurse = relationship("User", back_populates="leave_requests", foreign_keys=[nurse_id])
