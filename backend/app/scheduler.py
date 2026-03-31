"""
Smart Scheduling Algorithm for Nurse Shift Assignment.

Uses a greedy/constraint-satisfaction approach:
1. Collect all hard constraints (cannot_work, approved leave).
2. Collect soft constraints (preferences).
3. For each day × shift, assign nurses to meet minimum staffing
   while respecting constraints and balancing workload.
"""

from datetime import date, timedelta
from typing import Dict, List, Set, Tuple
from collections import defaultdict
from sqlalchemy.orm import Session
from app.models import (
    User, Department, ShiftConstraint, LeaveRequest, ShiftAssignment,
    Schedule, ShiftType, ConstraintType, RequestStatus, RoleEnum,
)


def generate_schedule(db: Session, department_id: int, week_start: date) -> Schedule:
    """Generate a weekly schedule for a department."""

    department = db.query(Department).filter(Department.id == department_id).first()
    if not department:
        raise ValueError("Department not found")

    # Get all active nurses in the department
    nurses = (
        db.query(User)
        .filter(User.department_id == department_id, User.is_active == True, User.role == RoleEnum.NURSE)
        .all()
    )
    if not nurses:
        raise ValueError("No active nurses in department")

    nurse_ids = [n.id for n in nurses]
    week_end = week_start + timedelta(days=6)

    # ── Gather constraints ─────────────────────────────
    hard_blocks: Dict[Tuple[int, date, ShiftType], bool] = {}
    soft_scores: Dict[Tuple[int, date, ShiftType], int] = defaultdict(int)

    # Shift constraints
    constraints = (
        db.query(ShiftConstraint)
        .filter(
            ShiftConstraint.nurse_id.in_(nurse_ids),
            ShiftConstraint.date >= week_start,
            ShiftConstraint.date <= week_end,
        )
        .all()
    )
    for c in constraints:
        key = (c.nurse_id, c.date, c.shift_type)
        if c.constraint_type == ConstraintType.CANNOT_WORK:
            hard_blocks[key] = True
        elif c.constraint_type == ConstraintType.PREFER_NOT:
            soft_scores[key] -= 10
        elif c.constraint_type == ConstraintType.PREFER:
            soft_scores[key] += 5

    # Approved leave requests
    leaves = (
        db.query(LeaveRequest)
        .filter(
            LeaveRequest.nurse_id.in_(nurse_ids),
            LeaveRequest.status == RequestStatus.APPROVED,
            LeaveRequest.start_date <= week_end,
            LeaveRequest.end_date >= week_start,
        )
        .all()
    )
    for leave in leaves:
        d = max(leave.start_date, week_start)
        while d <= min(leave.end_date, week_end):
            for shift in ShiftType:
                hard_blocks[(leave.nurse_id, d, shift)] = True
            d += timedelta(days=1)

    # ── Minimum staffing requirements ──────────────────
    min_nurses = {
        ShiftType.MORNING: department.min_nurses_morning,
        ShiftType.AFTERNOON: department.min_nurses_afternoon,
        ShiftType.NIGHT: department.min_nurses_night,
    }

    # ── Workload tracker ───────────────────────────────
    workload: Dict[int, int] = {nid: 0 for nid in nurse_ids}
    # Track which day a nurse last worked a night shift (for rest rule)
    last_night: Dict[int, date] = {}
    # Track daily assignments to avoid double-shifts
    daily_assigned: Dict[Tuple[int, date], Set[ShiftType]] = defaultdict(set)

    assignments: List[dict] = []

    # ── Assign shifts day by day ───────────────────────
    for day_offset in range(7):
        current_date = week_start + timedelta(days=day_offset)

        for shift_type in [ShiftType.MORNING, ShiftType.AFTERNOON, ShiftType.NIGHT]:
            required = min_nurses[shift_type]

            # Build candidate list
            candidates = []
            for nid in nurse_ids:
                key = (nid, current_date, shift_type)

                # Hard block?
                if hard_blocks.get(key):
                    continue

                # Already assigned a shift today?
                if daily_assigned[(nid, current_date)]:
                    continue

                # Rest after night shift: cannot work next day morning
                if shift_type == ShiftType.MORNING and last_night.get(nid) == current_date - timedelta(days=1):
                    continue

                # Score = soft preference + fairness (lower workload = higher priority)
                score = soft_scores[key] - workload[nid] * 3
                candidates.append((nid, score))

            # Sort by score descending (best candidates first)
            candidates.sort(key=lambda x: x[1], reverse=True)

            # Assign up to required number
            assigned_count = 0
            for nid, score in candidates:
                if assigned_count >= required:
                    break
                assignments.append({
                    "nurse_id": nid,
                    "date": current_date,
                    "shift_type": shift_type,
                })
                workload[nid] += 1
                daily_assigned[(nid, current_date)].add(shift_type)
                if shift_type == ShiftType.NIGHT:
                    last_night[nid] = current_date
                assigned_count += 1

    # ── Persist to database ────────────────────────────
    # Remove existing schedule for this week/department if any
    existing = (
        db.query(Schedule)
        .filter(Schedule.department_id == department_id, Schedule.week_start_date == week_start)
        .first()
    )
    if existing:
        db.delete(existing)
        db.flush()

    schedule = Schedule(department_id=department_id, week_start_date=week_start)
    db.add(schedule)
    db.flush()

    for a in assignments:
        db.add(ShiftAssignment(schedule_id=schedule.id, **a))

    db.commit()
    db.refresh(schedule)
    return schedule
