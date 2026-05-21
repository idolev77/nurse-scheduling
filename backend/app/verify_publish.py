from app.database import SessionLocal
from app.models import Schedule, NurseShiftStats, User, ShiftType
from datetime import date
from collections import defaultdict

db = SessionLocal()

sch = (
    db.query(Schedule)
    .filter(Schedule.week_start_date == date(2026, 5, 24))
    .order_by(Schedule.id.desc())
    .first()
)
print(f"Schedule id={sch.id} | is_published={sch.is_published} | assignments={len(sch.assignments)}")
print()

nurses = {u.id: f"{u.first_name} {u.last_name}" for u in db.query(User).all()}

# Expected counters per nurse from the published assignments
expected = defaultdict(lambda: {"nights": 0, "weekends": 0, "total": 0})
for a in sch.assignments:
    expected[a.nurse_id]["total"] += 1
    if a.shift_type == ShiftType.NIGHT:
        expected[a.nurse_id]["nights"] += 1
    if a.date.weekday() >= 4:  # Fri=4, Sat=5, Sun=6 (matches _is_weekend in scheduler)
        expected[a.nurse_id]["weekends"] += 1

print("=== NurseShiftStats (period 2026-05) ===")
stats = (
    db.query(NurseShiftStats)
    .filter(
        NurseShiftStats.period_year == 2026,
        NurseShiftStats.period_month == 5,
    )
    .order_by(NurseShiftStats.nurse_id)
    .all()
)
all_ok = True
for s in stats:
    nm = nurses.get(s.nurse_id, "?")
    exp = expected.get(s.nurse_id, {"nights": 0, "weekends": 0, "total": 0})
    nights_ok = s.night_shifts_count == exp["nights"]
    total_ok = s.total_shifts_count == exp["total"]
    weekend_ok = s.weekend_shifts_count == exp["weekends"]
    flag = "" if (nights_ok and total_ok and weekend_ok) else "  <-- MISMATCH"
    if flag:
        all_ok = False
    print(
        f"#{s.nurse_id} {nm:<20} "
        f"total={s.total_shifts_count}(exp={exp['total']}) "
        f"nights={s.night_shifts_count}(exp={exp['nights']}) "
        f"weekends={s.weekend_shifts_count}(exp={exp['weekends']}) "
        f"forced={s.forced_assignments_count} "
        f"fatigue={s.fatigue_index:.2f}"
        f"{flag}"
    )

print()
missing = [nid for nid in expected if not any(s.nurse_id == nid for s in stats)]
if missing:
    for nid in missing:
        print(f"MISSING STATS ROW: #{nid} {nurses.get(nid)}")
    all_ok = False
else:
    print("All nurses with assignments have a stats row.")

print()
if all_ok:
    print("RESULT: Stats match assignments exactly.")
else:
    print("RESULT: Mismatches detected (see above).")

db.close()
