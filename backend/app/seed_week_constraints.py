"""seed_week_constraints.py — Full week constraints (May 4–10, 2026):

  Maya Cohen (nurses[0]):
    • Saturday May 9  → PREFER AFTERNOON, CANNOT_WORK MORNING+NIGHT
    • All other days  → CANNOT_WORK for every shift

  All other nurses:
    • Mon–Fri (May 4–8) → PREFER MORNING + PREFER AFTERNOON, CANNOT_WORK NIGHT
    • Saturday (May 9)  → CANNOT_WORK for every shift
    • Sunday   (May 10) → CANNOT_WORK for every shift

Run from inside the backend container:
    python -m app.seed_week_constraints
"""
from datetime import date

from app.database import SessionLocal
from app.models import (
    User, RoleEnum, ShiftConstraint,
    ConstraintType, ShiftType,
)

# ── Week definition ───────────────────────────────────────────────────────────
WEEK_START  = date(2026, 5, 4)   # Monday
WEEKDAYS    = [date(2026, 5, d) for d in range(4, 9)]   # Mon–Fri (4,5,6,7,8)
SATURDAY    = date(2026, 5, 9)
SUNDAY      = date(2026, 5, 10)
ALL_DAYS    = WEEKDAYS + [SATURDAY, SUNDAY]
ALL_SHIFTS  = [ShiftType.MORNING, ShiftType.AFTERNOON, ShiftType.NIGHT]


def _set(db, nurse_id: int, day: date, shift: ShiftType, ctype: ConstraintType):
    """Delete any existing constraint for this slot then insert the new one."""
    db.query(ShiftConstraint).filter_by(
        nurse_id=nurse_id, date=day, shift_type=shift,
    ).delete(synchronize_session=False)
    db.add(ShiftConstraint(
        nurse_id=nurse_id,
        date=day,
        shift_type=shift,
        constraint_type=ctype,
    ))


def seed():
    db = SessionLocal()
    try:
        nurses = (
            db.query(User)
            .filter(User.role == RoleEnum.NURSE, User.is_active == True)
            .order_by(User.id)
            .all()
        )
        if not nurses:
            print("No active nurses found in the database. Aborting.")
            return

        print(f"Found {len(nurses)} active nurses.")
        nurse_ids = [n.id for n in nurses]

        # ── Wipe ALL constraints for this week for all nurses ─────────────────
        deleted = (
            db.query(ShiftConstraint)
            .filter(
                ShiftConstraint.nurse_id.in_(nurse_ids),
                ShiftConstraint.date >= WEEK_START,
                ShiftConstraint.date <= SUNDAY,
            )
            .delete(synchronize_session=False)
        )
        db.commit()
        print(f"Cleared {deleted} existing constraints for May 4–10.")

        # ── Maya Cohen: Saturday PREFER AFTERNOON, everything else CANNOT_WORK ─
        saturday_nurse = nurses[0]
        nid = saturday_nurse.id
        for day in ALL_DAYS:
            for shift in ALL_SHIFTS:
                if day == SATURDAY and shift == ShiftType.AFTERNOON:
                    _set(db, nid, day, shift, ConstraintType.PREFER)
                else:
                    _set(db, nid, day, shift, ConstraintType.CANNOT_WORK)
        print(f"  [Maya] {saturday_nurse.first_name} {saturday_nurse.last_name}: "
              f"PREFER AFTERNOON Sat, CANNOT_WORK everything else")

        # ── Other nurses: PREFER Mon–Fri mornings+afternoons, CANNOT_WORK rest ─
        for nurse in nurses[1:]:
            nid = nurse.id
            for day in ALL_DAYS:
                for shift in ALL_SHIFTS:
                    if day in WEEKDAYS and shift in (ShiftType.MORNING, ShiftType.AFTERNOON):
                        _set(db, nid, day, shift, ConstraintType.PREFER)
                    else:
                        _set(db, nid, day, shift, ConstraintType.CANNOT_WORK)
            print(f"  [Other] {nurse.first_name} {nurse.last_name}: "
                  f"PREFER MORNING+AFTERNOON Mon–Fri, CANNOT_WORK rest")

        db.commit()
        total = len(nurses) * len(ALL_DAYS) * len(ALL_SHIFTS)
        print(f"\nDone. Set {total} constraints total (no slot left empty).")

    except Exception as exc:
        db.rollback()
        raise exc
    finally:
        db.close()


if __name__ == "__main__":
    seed()
