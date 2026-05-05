from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field
from app.models import RoleEnum, ShiftType, ConstraintType, RequestStatus, SwapRequestStatus


# ── Auth ───────────────────────────────────────────────
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: int
    role: RoleEnum


# ── User ───────────────────────────────────────────────
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    role: RoleEnum = RoleEnum.NURSE
    department_id: Optional[int] = None
    employment_percentage: int = Field(default=100, ge=0, le=100)


class UserOut(BaseModel):
    id: int
    email: str
    first_name: str
    last_name: str
    role: RoleEnum
    department_id: Optional[int] = None
    employment_percentage: int = 100
    is_active: bool

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: Optional[RoleEnum] = None
    department_id: Optional[int] = None
    is_active: Optional[bool] = None
    employment_percentage: Optional[int] = Field(default=None, ge=0, le=100)


# ── Department ─────────────────────────────────────────
class DepartmentCreate(BaseModel):
    name: str
    min_nurses_morning: int = 2
    min_nurses_afternoon: int = 2
    min_nurses_night: int = 1


class DepartmentOut(BaseModel):
    id: int
    name: str
    min_nurses_morning: int
    min_nurses_afternoon: int
    min_nurses_night: int

    class Config:
        from_attributes = True


# ── Shift Constraint ──────────────────────────────────
class ShiftConstraintCreate(BaseModel):
    date: date
    shift_type: ShiftType
    constraint_type: ConstraintType


class ShiftConstraintOut(BaseModel):
    id: int
    nurse_id: int
    nurse_name: Optional[str] = None
    date: date
    shift_type: ShiftType
    constraint_type: ConstraintType

    @classmethod
    def from_orm(cls, obj):
        data = super().from_orm(obj)
        if obj.nurse:
            data.nurse_name = f"{obj.nurse.first_name} {obj.nurse.last_name}"
        return data

    class Config:
        from_attributes = True


# ── Leave Request ─────────────────────────────────────
class LeaveRequestCreate(BaseModel):
    start_date: date
    end_date: date
    reason: Optional[str] = None


class LeaveRequestOut(BaseModel):
    id: int
    nurse_id: int
    start_date: date
    end_date: date
    reason: Optional[str] = None
    status: RequestStatus

    class Config:
        from_attributes = True


class LeaveRequestReview(BaseModel):
    status: RequestStatus


# ── Schedule ──────────────────────────────────────────
class ScheduleCreate(BaseModel):
    department_id: int
    week_start_date: date


class ShiftAssignmentOut(BaseModel):
    id: int
    schedule_id: int
    nurse_id: int
    date: date
    shift_type: ShiftType
    nurse_name: Optional[str] = None

    class Config:
        from_attributes = True


class ScheduleOut(BaseModel):
    id: int
    department_id: int
    week_start_date: date
    is_published: bool
    assignments: List[ShiftAssignmentOut] = []

    class Config:
        from_attributes = True


class GenerateScheduleRequest(BaseModel):
    department_id: int
    week_start_date: date


class IterationLog(BaseModel):
    iteration: int
    score: float
    assigned: int
    required: int
    is_best: bool = False


class ScheduleGenerateResult(BaseModel):
    schedule: ScheduleOut
    total_required: int = 0
    total_assigned: int = 0
    warnings: List[str] = []
    iterations_log: List[IterationLog] = []


# ── Shift (schedulable slot) ─────────────────────
class ShiftOut(BaseModel):
    id: int
    department_id: int
    date: date
    shift_type: ShiftType
    required_staff: int

    class Config:
        from_attributes = True


class ShiftUpdate(BaseModel):
    required_staff: int = Field(ge=0)


class GenerateShiftsRequest(BaseModel):
    department_id: int
    week_start_date: date
    nurses_morning: Optional[int] = Field(default=None, ge=1)
    nurses_afternoon: Optional[int] = Field(default=None, ge=1)
    nurses_night: Optional[int] = Field(default=None, ge=1)


# ── Swap Requests (Shift Swap Marketplace) ────────────
class SwapRequestCreate(BaseModel):
    shift_assignment_id: int
    note: Optional[str] = None


class SwapRequestOut(BaseModel):
    id: int
    shift_assignment_id: int
    requester_id: int
    requester_name: Optional[str] = None
    claimant_id: Optional[int] = None
    claimant_name: Optional[str] = None
    status: SwapRequestStatus
    note: Optional[str] = None
    created_at: datetime
    # Denormalized shift info for display
    shift_date: Optional[date] = None
    shift_type: Optional[ShiftType] = None
    department_name: Optional[str] = None

    class Config:
        from_attributes = True


# ── Notifications ─────────────────────────────────────
class NotificationOut(BaseModel):
    id: int
    user_id: int
    message: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ── Nurse Shift Stats (fairness state table) ──────────
class NurseShiftStatsOut(BaseModel):
    id: int
    nurse_id: int
    nurse_name: Optional[str] = None
    period_year: int
    period_month: int
    night_shifts_count: int
    weekend_shifts_count: int
    total_shifts_count: int
    forced_assignments_count: int
    fatigue_index: float
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class NurseShiftStatsReset(BaseModel):
    """Body for manually resetting a nurse's stats for a period."""
    period_year: int
    period_month: int
