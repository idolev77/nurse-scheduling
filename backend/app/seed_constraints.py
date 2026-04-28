"""seed_constraints.py — Inserts shift constraints and leave requests for the
next two weeks for all nurses currently in the DB.

Run from the backend/ folder:
    python -m app.seed_constraints
"""
import random
from datetime import date, timedelta

from sqlalchemy import text
from app.database import SessionLocal
from app.models import (
    User, RoleEnum, ShiftConstraint, LeaveRequest,
    ConstraintType, ShiftType, RequestStatus,
)

TODAY = date(2026, 4, 28)
TWO_WEEKS = [TODAY + timedelta(days=i) for i in range(14)]  # Apr 28 – May 11

SHIFT_TYPES = [ShiftType.MORNING, ShiftType.AFTERNOON, ShiftType.NIGHT]

random.seed(42)  # reproducible


def seed():
    db = SessionLocal()
    try:
        nurses = db.query(User).filter(User.role == RoleEnum.NURSE, User.is_active == True).all()
        if not nurses:
            print("No nurses found in the database. Aborting.")
            return

        print(f"Found {len(nurses)} nurses.")

        # ── Clear existing constraints / leave requests for this window ──────
        min_date = TWO_WEEKS[0]
        max_date = TWO_WEEKS[-1]
        nurse_ids = [n.id for n in nurses]

        deleted_c = db.query(ShiftConstraint).filter(
            ShiftConstraint.nurse_id.in_(nurse_ids),
            ShiftConstraint.date >= min_date,
            ShiftConstraint.date <= max_date,
        ).delete(synchronize_session=False)

        deleted_l = db.query(LeaveRequest).filter(
            LeaveRequest.nurse_id.in_(nurse_ids),
            LeaveRequest.start_date >= min_date,
            LeaveRequest.end_date <= max_date,
        ).delete(synchronize_session=False)

        db.commit()
        print(f"Cleared {deleted_c} old constraints and {deleted_l} old leave requests.")

        # ── Helper: pick a random weekday-subset for each nurse ───────────────
        def random_days(n=3):
            return random.sample(TWO_WEEKS, n)

        constraints_added = 0
        leave_added = 0

        for nurse in nurses:
            nid = nurse.id
            name = f"{nurse.first_name} {nurse.last_name}"

            # ── Pattern A: 1-3 CANNOT_WORK constraints (e.g. personal conflicts) ──
            cannot_count = random.randint(1, 3)
            for day in random.sample(TWO_WEEKS, cannot_count):
                shift = random.choice(SHIFT_TYPES)
                existing = db.query(ShiftConstraint).filter_by(
                    nurse_id=nid, date=day, shift_type=shift).first()
                if not existing:
                    db.add(ShiftConstraint(
                        nurse_id=nid,
                        date=day,
                        shift_type=shift,
                        constraint_type=ConstraintType.CANNOT_WORK,
                        note="Personal conflict",
                    ))
                    constraints_added += 1

            # ── Pattern B: 2-4 PREFER_NOT constraints (e.g. prefers not nights) ──
            prefer_not_count = random.randint(2, 4)
            # roughly half nurses prefer not nights, half prefer not mornings
            if nid % 2 == 0:
                avoided_shift = ShiftType.NIGHT
                note = "Prefers not to work night shifts"
            else:
                avoided_shift = ShiftType.MORNING
                note = "Prefers not to work early mornings"

            for day in random.sample(TWO_WEEKS, prefer_not_count):
                existing = db.query(ShiftConstraint).filter_by(
                    nurse_id=nid, date=day, shift_type=avoided_shift).first()
                if not existing:
                    db.add(ShiftConstraint(
                        nurse_id=nid,
                        date=day,
                        shift_type=avoided_shift,
                        constraint_type=ConstraintType.PREFER_NOT,
                        note=note,
                    ))
                    constraints_added += 1

            # ── Pattern C: 1-2 PREFER constraints (preferred shifts) ─────────
            prefer_count = random.randint(1, 2)
            preferred_shift = ShiftType.AFTERNOON if nid % 3 == 0 else ShiftType.MORNING
            for day in random.sample(TWO_WEEKS, prefer_count):
                existing = db.query(ShiftConstraint).filter_by(
                    nurse_id=nid, date=day, shift_type=preferred_shift).first()
                if not existing:
                    db.add(ShiftConstraint(
                        nurse_id=nid,
                        date=day,
                        shift_type=preferred_shift,
                        constraint_type=ConstraintType.PREFER,
                        note="Preferred shift",
                    ))
                    constraints_added += 1

        db.commit()
        print(f"Added {constraints_added} shift constraints.")

        # ── Leave Requests (roughly 35% of nurses get one) ────────────────────
        leave_candidates = random.sample(nurses, max(1, len(nurses) * 35 // 100))

        leave_scenarios = [
            # (duration_days, reason, status)
            (1, "Medical appointment", RequestStatus.APPROVED),
            (2, "Family event", RequestStatus.PENDING),
            (1, "Personal leave", RequestStatus.PENDING),
            (3, "Sick leave", RequestStatus.APPROVED),
            (2, "Childcare", RequestStatus.PENDING),
            (1, "Annual leave", RequestStatus.APPROVED),
            (4, "Vacation", RequestStatus.PENDING),
            (1, "Medical procedure", RequestStatus.APPROVED),
        ]

        for nurse in leave_candidates:
            scenario = random.choice(leave_scenarios)
            duration, reason, status = scenario

            # Pick a start date that fits within the window
            max_start_index = 14 - duration
            start_offset = random.randint(0, max_start_index)
            start = TODAY + timedelta(days=start_offset)
            end = start + timedelta(days=duration - 1)

            db.add(LeaveRequest(
                nurse_id=nurse.id,
                start_date=start,
                end_date=end,
                reason=reason,
                status=status,
            ))
            leave_added += 1
            print(f"  Leave: {nurse.first_name} {nurse.last_name} | {start} → {end} | {reason} [{status.value}]")

        db.commit()
        print(f"Added {leave_added} leave requests.")
        print("Done.")

    except Exception as exc:
        db.rollback()
        raise exc
    finally:
        db.close()


if __name__ == "__main__":
    seed()
