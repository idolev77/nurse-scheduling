"""Quick smoke test for the scheduler — verifies no same-day doubles."""
from datetime import date

from app.database import SessionLocal
from app.scheduler import generate_schedule
from app.models import ShiftAssignment


def main():
    db = SessionLocal()
    try:
        schedule, warnings, total_req, total_assigned, logs = generate_schedule(
            db, department_id=1, week_start=date(2026, 5, 24), iterations=20,
        )
        print(f"Schedule id={schedule.id}  assigned={total_assigned}/{total_req}")
        best = [l for l in logs if l["is_best"]]
        print(f"Best iteration log: {best}")
        print(f"Warnings: {len(warnings)}")
        for w in warnings[:8]:
            print(f"  - {w}")

        # Check for same-day doubles
        asgns = db.query(ShiftAssignment).filter_by(schedule_id=schedule.id).all()
        nurse_day = {}
        for a in asgns:
            nurse_day.setdefault((a.nurse_id, a.date), []).append(a.shift_type.value)
        doubles = [(nid, d, sts) for (nid, d), sts in nurse_day.items() if len(sts) > 1]
        if doubles:
            print(f"\nDOUBLES FOUND: {len(doubles)}")
            for nid, d, sts in doubles:
                print(f"  nurse={nid} date={d} shifts={sts}")
        else:
            print(f"\nNo same-day doubles. {len(asgns)} total assignments.")

        # Print full schedule
        print("\n=== SCHEDULE ===")
        for d_iter in sorted({a.date for a in asgns}):
            day_asgns = [a for a in asgns if a.date == d_iter]
            day_asgns.sort(key=lambda a: a.shift_type.value)
            line = f"{d_iter} ({d_iter.strftime('%a')}): "
            for a in day_asgns:
                line += f"[{a.shift_type.value[0].upper()} n{a.nurse_id}] "
            print(line)
    finally:
        db.close()


if __name__ == "__main__":
    main()
