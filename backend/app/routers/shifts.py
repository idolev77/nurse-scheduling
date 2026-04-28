"""
Shift slot management — prepare weekly shifts and adjust required_staff.
"""
from datetime import timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import require_role
from app.database import get_db
from app.models import Department, Shift, ShiftType, User, RoleEnum
from app.schemas import GenerateShiftsRequest, ShiftOut, ShiftUpdate

router = APIRouter(prefix="/api/shifts", tags=["Shifts"])


@router.post("/generate-week", response_model=List[ShiftOut], status_code=201)
def generate_week_shifts(
    payload: GenerateShiftsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.HEAD_NURSE, RoleEnum.ADMIN)),
):
    """
    Create shift slots for a 7-day week (idempotent).
    Uses department min_nurses defaults for required_staff.
    """
    dept = db.query(Department).filter(Department.id == payload.department_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")

    default_staff = {
        ShiftType.MORNING:   payload.nurses_morning   if payload.nurses_morning   is not None else dept.min_nurses_morning,
        ShiftType.AFTERNOON: payload.nurses_afternoon if payload.nurses_afternoon is not None else dept.min_nurses_afternoon,
        ShiftType.NIGHT:     payload.nurses_night     if payload.nurses_night     is not None else dept.min_nurses_night,
    }

    created = []
    for day_offset in range(7):
        d = payload.week_start_date + timedelta(days=day_offset)
        for st in ShiftType:
            existing = (
                db.query(Shift)
                .filter(
                    Shift.department_id == payload.department_id,
                    Shift.date == d,
                    Shift.shift_type == st,
                )
                .first()
            )
            if existing:
                existing.required_staff = default_staff[st]
                created.append(existing)
            else:
                shift = Shift(
                    department_id=payload.department_id,
                    date=d,
                    shift_type=st,
                    required_staff=default_staff[st],
                )
                db.add(shift)
                db.flush()
                created.append(shift)

    db.commit()
    for s in created:
        db.refresh(s)
    return created


@router.get("/", response_model=List[ShiftOut])
def list_shifts(
    department_id: int = None,
    week_start: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.HEAD_NURSE, RoleEnum.ADMIN, RoleEnum.NURSE)),
):
    """List shifts, optionally filtered by department and week."""
    query = db.query(Shift)
    if department_id:
        query = query.filter(Shift.department_id == department_id)
    if week_start:
        from datetime import date as date_type
        ws = date_type.fromisoformat(week_start)
        we = ws + timedelta(days=6)
        query = query.filter(Shift.date >= ws, Shift.date <= we)
    return query.order_by(Shift.date, Shift.shift_type).all()


@router.put("/{shift_id}", response_model=ShiftOut)
def update_shift(
    shift_id: int,
    payload: ShiftUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.HEAD_NURSE, RoleEnum.ADMIN)),
):
    """Update required_staff for a specific shift slot."""
    shift = db.query(Shift).filter(Shift.id == shift_id).first()
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")
    shift.required_staff = payload.required_staff
    db.commit()
    db.refresh(shift)
    return shift
