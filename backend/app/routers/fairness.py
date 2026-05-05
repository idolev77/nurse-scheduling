import math
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import extract
from sqlalchemy.orm import Session

from app.auth import require_role
from app.database import get_db
from app.models import ConstraintType, RoleEnum, Schedule, ShiftAssignment, ShiftConstraint, ShiftType, User

router = APIRouter(prefix="/api/fairness", tags=["Fairness Analytics"])

# Friday (4) and Saturday (5) = Shabbat / weekend in Israel
WEEKEND_WEEKDAYS = {4, 5}


def _stats(values: list) -> dict:
    if not values:
        return {"mean": 0.0, "std_dev": 0.0, "variance": 0.0, "min": 0, "max": 0}
    mean = sum(values) / len(values)
    variance = sum((v - mean) ** 2 for v in values) / len(values)
    return {
        "mean": round(mean, 2),
        "std_dev": round(math.sqrt(variance), 2),
        "variance": round(variance, 2),
        "min": min(values),
        "max": max(values),
    }


@router.get("/shift-distribution")
def shift_distribution(
    department_id: Optional[int] = Query(None, description="Filter by department"),
    year: Optional[int] = Query(None, description="Filter by year"),
    month: Optional[int] = Query(None, description="Filter by month (1-12)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.HEAD_NURSE, RoleEnum.ADMIN)),
):
    """
    Count constraint violations on weekend and night shifts.
    A violation = a nurse was assigned a weekend (Fri/Sat) or night shift
    that they explicitly marked as CANNOT_WORK (hard) or PREFER_NOT (soft).
    Nurses who wanted those shifts and got them are NOT counted.
    """
    query = (
        db.query(ShiftAssignment)
        .join(Schedule, ShiftAssignment.schedule_id == Schedule.id)
        .filter(Schedule.is_published == True)  # noqa: E712
    )

    if department_id:
        query = query.filter(Schedule.department_id == department_id)
    if year:
        query = query.filter(extract("year", ShiftAssignment.date) == year)
    if month:
        query = query.filter(extract("month", ShiftAssignment.date) == month)

    assignments = query.all()

    # Pre-load all relevant constraints into a fast lookup dict
    all_nurse_ids = list({a.nurse_id for a in assignments})
    constraint_lookup: dict = {}
    if all_nurse_ids:
        constraints = (
            db.query(ShiftConstraint)
            .filter(
                ShiftConstraint.nurse_id.in_(all_nurse_ids),
                ShiftConstraint.constraint_type.in_(
                    [ConstraintType.CANNOT_WORK, ConstraintType.PREFER_NOT]
                ),
            )
            .all()
        )
        for c in constraints:
            # If multiple constraints exist for same slot, last wins (edge case)
            constraint_lookup[(c.nurse_id, c.date, c.shift_type)] = c.constraint_type

    nurse_cache: dict[int, User] = {}
    nurse_data: dict[int, dict] = {}
    total_checked = 0

    for a in assignments:
        is_weekend = a.date.weekday() in WEEKEND_WEEKDAYS
        is_night = a.shift_type == ShiftType.NIGHT

        # Only examine weekend (Fri/Sat) or night shifts
        if not (is_weekend or is_night):
            continue

        total_checked += 1

        if a.nurse_id not in nurse_cache:
            nurse = db.query(User).filter(User.id == a.nurse_id, User.is_active == True).first()  # noqa: E712
            if nurse is None:
                continue
            nurse_cache[a.nurse_id] = nurse

        nurse = nurse_cache.get(a.nurse_id)
        if nurse is None:
            continue

        if a.nurse_id not in nurse_data:
            nurse_data[a.nurse_id] = {
                "nurse_id": a.nurse_id,
                "name": f"{nurse.first_name} {nurse.last_name}",
                "hard_violations": 0,   # CANNOT_WORK — assigned despite explicit refusal
                "soft_violations": 0,   # PREFER_NOT  — assigned despite preference against
                "total_violations": 0,
                "weekend_night_shifts": 0,
            }

        entry = nurse_data[a.nurse_id]
        entry["weekend_night_shifts"] += 1

        ctype = constraint_lookup.get((a.nurse_id, a.date, a.shift_type))
        if ctype == ConstraintType.CANNOT_WORK:
            entry["hard_violations"] += 1
            entry["total_violations"] += 1
        elif ctype == ConstraintType.PREFER_NOT:
            entry["soft_violations"] += 1
            entry["total_violations"] += 1

    nurses = sorted(nurse_data.values(), key=lambda x: x["name"])

    total_violations_list = [n["total_violations"] for n in nurses]
    hard_violations_list = [n["hard_violations"] for n in nurses]
    soft_violations_list = [n["soft_violations"] for n in nurses]

    return {
        "nurses": nurses,
        "total_stats": _stats(total_violations_list),
        "hard_stats": _stats(hard_violations_list),
        "soft_stats": _stats(soft_violations_list),
        "total_violations": sum(total_violations_list),
        "total_assignments_checked": total_checked,
    }
