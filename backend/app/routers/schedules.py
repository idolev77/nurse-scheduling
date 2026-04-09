from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Schedule, ShiftAssignment, User, RoleEnum
from app.schemas import ScheduleOut, ShiftAssignmentOut, GenerateScheduleRequest, ScheduleGenerateResult
from app.auth import get_current_user, require_role
from app.scheduler import generate_schedule

router = APIRouter(prefix="/api/schedules", tags=["Schedules"])


def _format_schedule(schedule: Schedule, db: Session) -> dict:
    assignments = []
    for a in schedule.assignments:
        nurse = db.query(User).filter(User.id == a.nurse_id).first()
        assignments.append(ShiftAssignmentOut(
            id=a.id,
            schedule_id=a.schedule_id,
            nurse_id=a.nurse_id,
            date=a.date,
            shift_type=a.shift_type,
            nurse_name=f"{nurse.first_name} {nurse.last_name}" if nurse else None,
        ))
    return ScheduleOut(
        id=schedule.id,
        department_id=schedule.department_id,
        week_start_date=schedule.week_start_date,
        is_published=schedule.is_published,
        assignments=assignments,
    )


@router.get("/", response_model=List[ScheduleOut])
def list_schedules(
    department_id: int = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Schedule)
    if department_id:
        query = query.filter(Schedule.department_id == department_id)
    # Regular nurses see only published schedules
    if current_user.role == RoleEnum.NURSE:
        query = query.filter(Schedule.is_published == True)
    schedules = query.all()
    return [_format_schedule(s, db) for s in schedules]


@router.get("/{schedule_id}", response_model=ScheduleOut)
def get_schedule(schedule_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    if current_user.role == RoleEnum.NURSE and not schedule.is_published:
        raise HTTPException(status_code=403, detail="Schedule not yet published")
    return _format_schedule(schedule, db)


@router.post("/generate", response_model=ScheduleGenerateResult, status_code=201)
def generate(
    payload: GenerateScheduleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.HEAD_NURSE, RoleEnum.ADMIN)),
):
    try:
        schedule, warnings, total_required, total_assigned = generate_schedule(
            db, payload.department_id, payload.week_start_date
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return ScheduleGenerateResult(
        schedule=_format_schedule(schedule, db),
        total_required=total_required,
        total_assigned=total_assigned,
        warnings=warnings,
    )


@router.put("/{schedule_id}/publish", response_model=ScheduleOut)
def publish_schedule(
    schedule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.HEAD_NURSE, RoleEnum.ADMIN)),
):
    schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    schedule.is_published = True
    db.commit()
    db.refresh(schedule)
    return _format_schedule(schedule, db)
