from app.database import SessionLocal
from app.models import (
    User, ShiftConstraint, ShiftAssignment, Schedule,
    LeaveRequest, ConstraintType, ShiftType, RequestStatus,
)
from datetime import date
from collections import defaultdict

db = SessionLocal()
sch = (
    db.query(Schedule)
    .filter(Schedule.week_start_date == date(2026, 5, 24))
    .order_by(Schedule.id.desc())
    .first()
)
print("SCHEDULE id=", sch.id, "published=", sch.is_published)

nurses = {u.id: f"{u.first_name} {u.last_name}" for u in db.query(User).all()}
assigns = sorted(sch.assignments, key=lambda x: (x.date, x.shift_type.value))

print("\n=== ASSIGNMENTS ===")
for a in assigns:
    nm = nurses.get(a.nurse_id, "?")
    print(f"{a.date} {a.shift_type.value:9} #{a.nurse_id} {nm}")

cs = (
    db.query(ShiftConstraint)
    .filter(
        ShiftConstraint.date >= date(2026, 5, 24),
        ShiftConstraint.date <= date(2026, 5, 30),
    )
    .order_by(ShiftConstraint.date, ShiftConstraint.nurse_id)
    .all()
)

# index constraints by (nurse_id, date) -> list[(type, shift_type)]
by_nd = defaultdict(list)
for c in cs:
    by_nd[(c.nurse_id, c.date)].append(
        (c.constraint_type.value, c.shift_type.value)
    )

print("\n=== CONSTRAINTS (week 5/24-5/30) ===")
for c in cs:
    st = c.shift_type.value
    print(
        f"{c.date} {c.constraint_type.value:11} {st:9} #{c.nurse_id} {nurses.get(c.nurse_id, '?')}"
    )

lvs = (
    db.query(LeaveRequest)
    .filter(
        LeaveRequest.status == RequestStatus.APPROVED,
        LeaveRequest.start_date <= date(2026, 5, 30),
        LeaveRequest.end_date >= date(2026, 5, 24),
    )
    .all()
)
leaves_by_nurse = {}
print("\n=== APPROVED LEAVES overlapping ===")
for l in lvs:
    leaves_by_nurse.setdefault(l.nurse_id, []).append((l.start_date, l.end_date))
    print(f"#{l.nurse_id} {nurses.get(l.nurse_id, '?')}: {l.start_date} .. {l.end_date}")

# Cross-check: for each assignment, did we violate a constraint?
print("\n=== VIOLATION CHECK (per assignment) ===")
violations = []
for a in assigns:
    nm = nurses.get(a.nurse_id, "?")
    # leave violation
    for s, e in leaves_by_nurse.get(a.nurse_id, []):
        if s <= a.date <= e:
            violations.append(
                f"LEAVE VIOLATION: {a.date} {a.shift_type.value} #{a.nurse_id} {nm} (on approved leave {s}..{e})"
            )
    # constraint violation
    for ctype, stype in by_nd.get((a.nurse_id, a.date), []):
        applies = stype == "ALL" or stype == a.shift_type.value
        if applies and ctype == "cannot_work":
            violations.append(
                f"CANNOT_WORK OVERRIDDEN: {a.date} {a.shift_type.value} #{a.nurse_id} {nm} (constraint={stype})"
            )
        elif applies and ctype == "prefer_not":
            violations.append(
                f"PREFER_NOT (soft): {a.date} {a.shift_type.value} #{a.nurse_id} {nm} (constraint={stype})"
            )

if not violations:
    print("No violations found.")
else:
    for v in violations:
        print(v)

# Same-day double check
print("\n=== SAME-DAY DOUBLES ===")
by_nurse_date = defaultdict(list)
for a in assigns:
    by_nurse_date[(a.nurse_id, a.date)].append(a.shift_type.value)
doubles = {k: v for k, v in by_nurse_date.items() if len(v) > 1}
if not doubles:
    print("None.")
else:
    for (nid, d), shifts in doubles.items():
        print(f"#{nid} {nurses.get(nid)} on {d}: {shifts}")

# Night -> next morning check
print("\n=== NIGHT -> NEXT MORNING ===")
from datetime import timedelta
nights = {(a.nurse_id, a.date) for a in assigns if a.shift_type == ShiftType.NIGHT}
flags = []
for a in assigns:
    if a.shift_type == ShiftType.MORNING and (a.nurse_id, a.date - timedelta(days=1)) in nights:
        flags.append(f"#{a.nurse_id} {nurses.get(a.nurse_id)}: night {a.date - timedelta(days=1)} -> morning {a.date}")
if not flags:
    print("None.")
else:
    for f in flags:
        print(f)

# Weekend load count
print("\n=== WEEKEND SHIFTS (Fri 29/05 + Sat 30/05) ===")
we = [a for a in assigns if a.date in (date(2026,5,29), date(2026,5,30))]
ct = defaultdict(int)
for a in we:
    ct[a.nurse_id] += 1
for nid, n in sorted(ct.items(), key=lambda x: -x[1]):
    print(f"#{nid} {nurses.get(nid)}: {n} weekend shift(s)")

db.close()
