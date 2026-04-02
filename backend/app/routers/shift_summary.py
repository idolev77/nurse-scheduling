from calendar import monthrange
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import extract
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import LeaveRequest, RequestStatus, ShiftAssignment, ShiftType, User

router = APIRouter(prefix="/api/shift-summary", tags=["Shift Summary"])

HOURS_PER_SHIFT = 8
MONTHLY_QUOTA = 160  # standard full-time monthly hours


def _week_of_month(d: date) -> int:
    return (d.day - 1) // 7 + 1


def _count_approved_leave_days(db: Session, nurse_id: int, year: int, month: int) -> int:
    """Count unique days in the given month covered by approved leave requests."""
    _, days_in_month = monthrange(year, month)
    month_start = date(year, month, 1)
    month_end = date(year, month, days_in_month)

    approved_leaves = (
        db.query(LeaveRequest)
        .filter(
            LeaveRequest.nurse_id == nurse_id,
            LeaveRequest.status == RequestStatus.APPROVED,
            LeaveRequest.start_date <= month_end,
            LeaveRequest.end_date >= month_start,
        )
        .all()
    )

    leave_days: set = set()
    for leave in approved_leaves:
        current = max(leave.start_date, month_start)
        end = min(leave.end_date, month_end)
        delta = (end - current).days
        for i in range(delta + 1):
            leave_days.add(current + timedelta(days=i))

    return len(leave_days)


def _compute_summary(assignments: list, year: int, month: int, leave_days: int) -> dict:
    total_shifts = len(assignments)
    total_hours = total_shifts * HOURS_PER_SHIFT

    # Leave days reduce the effective monthly quota
    leave_hours = leave_days * HOURS_PER_SHIFT
    effective_quota = max(0, MONTHLY_QUOTA - leave_hours)

    hours_remaining = max(0, effective_quota - total_hours)
    completion_pct = round(min(100.0, (total_hours / effective_quota) * 100), 1) if effective_quota > 0 else 100.0

    # Shift breakdown by type
    breakdown = {t.value: {"count": 0, "hours": 0} for t in ShiftType}
    weekly: dict[int, int] = {}

    for a in assignments:
        breakdown[a.shift_type.value]["count"] += 1
        breakdown[a.shift_type.value]["hours"] += HOURS_PER_SHIFT
        w = _week_of_month(a.date)
        weekly[w] = weekly.get(w, 0) + HOURS_PER_SHIFT

    shift_counts = {k: v["count"] for k, v in breakdown.items() if v["count"] > 0}
    most_frequent = max(shift_counts, key=lambda k: shift_counts[k]) if shift_counts else None

    _, days_in_month = monthrange(year, month)
    max_week = _week_of_month(date(year, month, days_in_month))
    weekly_distribution = [
        {"week": w, "label": f"Week {w}", "hours": weekly.get(w, 0)}
        for w in range(1, max_week + 1)
    ]

    avg_hours_per_shift = round(total_hours / total_shifts, 1) if total_shifts else 0.0

    return {
        "year": year,
        "month": month,
        "monthly_quota": MONTHLY_QUOTA,
        "effective_quota": effective_quota,
        "leave_days": leave_days,
        "leave_hours": leave_hours,
        "total_hours": total_hours,
        "hours_remaining": hours_remaining,
        "completion_pct": completion_pct,
        "shifts_count": total_shifts,
        "avg_hours_per_shift": avg_hours_per_shift,
        "most_frequent_shift": most_frequent,
        "shift_breakdown": breakdown,
        "weekly_distribution": weekly_distribution,
    }


def _query_assignments(db: Session, nurse_id: int, year: int, month: int):
    return (
        db.query(ShiftAssignment)
        .filter(
            ShiftAssignment.nurse_id == nurse_id,
            extract("year", ShiftAssignment.date) == year,
            extract("month", ShiftAssignment.date) == month,
        )
        .all()
    )


@router.get("/me")
def get_my_shift_summary(
    year: Optional[int] = Query(None, ge=2000, le=2100),
    month: Optional[int] = Query(None, ge=1, le=12),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()
    target_year = year or today.year
    target_month = month or today.month

    curr_assignments = _query_assignments(db, current_user.id, target_year, target_month)
    leave_days = _count_approved_leave_days(db, current_user.id, target_year, target_month)
    summary = _compute_summary(curr_assignments, target_year, target_month, leave_days)

    # Previous month comparison
    if target_month == 1:
        prev_year, prev_month = target_year - 1, 12
    else:
        prev_year, prev_month = target_year, target_month - 1

    prev_assignments = _query_assignments(db, current_user.id, prev_year, prev_month)
    prev_leave_days = _count_approved_leave_days(db, current_user.id, prev_year, prev_month)
    prev_hours = len(prev_assignments) * HOURS_PER_SHIFT
    prev_effective_quota = max(0, MONTHLY_QUOTA - prev_leave_days * HOURS_PER_SHIFT)

    change_hours = summary["total_hours"] - prev_hours
    change_pct = round((change_hours / prev_hours) * 100, 1) if prev_hours > 0 else None

    summary["prev_month_comparison"] = {
        "prev_total_hours": prev_hours,
        "prev_effective_quota": prev_effective_quota,
        "change_hours": change_hours,
        "change_pct": change_pct,
    }

    return summary
