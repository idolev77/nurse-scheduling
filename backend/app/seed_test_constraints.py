"""
seed_test_constraints.py
Seed realistic shift constraints + leave requests for all nurses
for the period May 21 – June 13, 2026 (24 days / ~3.5 weeks).

Run inside the backend container:
    python -m app.seed_test_constraints
"""
from datetime import date, timedelta

from app.database import SessionLocal
from app.models import (
    User, RoleEnum, ShiftConstraint, LeaveRequest,
    ConstraintType, ShiftType, RequestStatus,
)

# ── Date range ────────────────────────────────────────────────────────────────
START = date(2026, 5, 21)
END   = date(2026, 6, 13)
ALL_DAYS   = [START + timedelta(days=i) for i in range((END - START).days + 1)]
ALL_SHIFTS = [ShiftType.MORNING, ShiftType.AFTERNOON, ShiftType.NIGHT]

# Nurse IDs (matching the DB)
MAYA   = 18  # 100% — prefers mornings, hates nights
NOA    = 19  # 100% — flexible, some CANNOT_WORK nights
SHIRA  = 20  # 50%  — part-time, prefers mornings
TAL    = 21  # 50%  — part-time, prefers afternoons
DANA   = 22  # 100% — prefers mornings, dislikes nights
LIHI   = 23  # 100% — prefers nights
ORI    = 24  # 100% — prefers afternoons
MICHAL = 26  # 50%  — part-time, prefers mornings
RINA   = 27  # 80%  — prefers afternoons

M  = ShiftType.MORNING
A  = ShiftType.AFTERNOON
N  = ShiftType.NIGHT
CW = ConstraintType.CANNOT_WORK
PR = ConstraintType.PREFER
PN = ConstraintType.PREFER_NOT


def d(month: int, day: int) -> date:
    return date(2026, month, day)


# ── Constraint specification ──────────────────────────────────────────────────
# Format: (nurse_id, date, shift_type, constraint_type)
CONSTRAINTS = [

    # ════════════════ MAYA (18) — 100%, prefers mornings ════════════════
    # Week 1 (May 21-27)
    (MAYA, d(5,21), M, PR), (MAYA, d(5,21), N, PN),
    (MAYA, d(5,22), M, PR), (MAYA, d(5,22), N, PN),
    (MAYA, d(5,23), M, PR), (MAYA, d(5,23), N, PN),
    (MAYA, d(5,25), M, PR),
    (MAYA, d(5,26), M, CW), (MAYA, d(5,26), A, CW), (MAYA, d(5,26), N, CW),  # full day off (Sat)
    # Week 2 (May 28 – Jun 3) — leave handled separately
    (MAYA, d(5,28), M, PR), (MAYA, d(5,28), N, PN),
    (MAYA, d(5,29), M, PR),
    (MAYA, d(5,30), M, PR),
    # Week 3 (Jun 4-10) — back from leave
    (MAYA, d(6, 4), M, PR), (MAYA, d(6, 4), N, PN),
    (MAYA, d(6, 5), M, PR), (MAYA, d(6, 5), N, PN),
    (MAYA, d(6, 6), M, PR),
    (MAYA, d(6, 9), M, CW), (MAYA, d(6, 9), A, CW), (MAYA, d(6, 9), N, CW),  # Sat off
    # Week 4 partial (Jun 11-13)
    (MAYA, d(6,11), M, PR),
    (MAYA, d(6,12), M, PR),
    (MAYA, d(6,13), N, PN),

    # ════════════════ NOA (19) — 100%, flexible ══════════════════════════
    (NOA, d(5,21), N, CW),
    (NOA, d(5,22), A, PR), (NOA, d(5,22), N, PN),
    (NOA, d(5,23), A, PR),
    (NOA, d(5,24), A, PR),
    (NOA, d(5,27), M, CW), (NOA, d(5,27), A, CW), (NOA, d(5,27), N, CW),  # Sun off
    (NOA, d(5,28), M, PR),
    (NOA, d(5,29), M, PR),
    (NOA, d(5,30), M, PR),
    (NOA, d(6, 3), N, PN),
    (NOA, d(6, 4), N, CW),
    (NOA, d(6, 5), N, PN),
    (NOA, d(6, 6), N, PN),
    (NOA, d(6, 9), N, PN),
    (NOA, d(6,11), M, PR),
    (NOA, d(6,12), M, PR),
    (NOA, d(6,13), N, CW),

    # ════════════════ SHIRA (20) — 50%, part-time mornings ═══════════════
    (SHIRA, d(5,21), M, PR),
    (SHIRA, d(5,22), M, PR),
    (SHIRA, d(5,22), N, CW),
    (SHIRA, d(5,23), M, PR),
    (SHIRA, d(5,24), N, CW),
    (SHIRA, d(5,26), M, CW), (SHIRA, d(5,26), A, CW), (SHIRA, d(5,26), N, CW),
    (SHIRA, d(5,27), M, CW), (SHIRA, d(5,27), A, CW), (SHIRA, d(5,27), N, CW),
    (SHIRA, d(5,28), A, CW),
    (SHIRA, d(5,29), M, PR),
    (SHIRA, d(5,30), M, PR),
    (SHIRA, d(6, 2), M, CW), (SHIRA, d(6, 2), A, CW), (SHIRA, d(6, 2), N, CW),
    (SHIRA, d(6, 3), M, CW), (SHIRA, d(6, 3), A, CW), (SHIRA, d(6, 3), N, CW),
    (SHIRA, d(6, 4), M, PR),
    (SHIRA, d(6, 5), M, PR),
    (SHIRA, d(6, 5), N, CW),
    (SHIRA, d(6, 9), M, CW), (SHIRA, d(6, 9), A, CW), (SHIRA, d(6, 9), N, CW),
    (SHIRA, d(6,10), M, CW), (SHIRA, d(6,10), A, CW), (SHIRA, d(6,10), N, CW),
    (SHIRA, d(6,11), M, PR),
    (SHIRA, d(6,12), N, CW),

    # ════════════════ TAL (21) — 50%, part-time afternoons ═══════════════
    (TAL, d(5,21), A, PR),
    (TAL, d(5,22), A, PR),
    (TAL, d(5,23), A, PR),
    (TAL, d(5,23), N, CW),
    (TAL, d(5,24), A, PR),
    (TAL, d(5,25), N, CW),
    (TAL, d(5,26), M, CW), (TAL, d(5,26), A, CW), (TAL, d(5,26), N, CW),
    (TAL, d(5,27), M, CW), (TAL, d(5,27), A, CW), (TAL, d(5,27), N, CW),
    (TAL, d(5,28), A, PR),
    (TAL, d(5,29), A, PR),
    (TAL, d(5,31), N, CW),
    (TAL, d(6, 2), M, CW), (TAL, d(6, 2), A, CW), (TAL, d(6, 2), N, CW),
    (TAL, d(6, 3), M, CW), (TAL, d(6, 3), A, CW), (TAL, d(6, 3), N, CW),
    (TAL, d(6, 4), A, PR),
    (TAL, d(6, 5), A, PR),
    (TAL, d(6, 6), A, PR),
    (TAL, d(6, 9), M, CW), (TAL, d(6, 9), A, CW), (TAL, d(6, 9), N, CW),
    (TAL, d(6,10), M, CW), (TAL, d(6,10), A, CW), (TAL, d(6,10), N, CW),
    (TAL, d(6,11), A, PR),
    (TAL, d(6,12), A, PR),

    # ════════════════ DANA (22) — 100%, prefers mornings ═════════════════
    (DANA, d(5,21), M, PR),
    (DANA, d(5,22), M, PR),
    (DANA, d(5,22), N, PN),
    (DANA, d(5,23), N, PN),
    (DANA, d(5,24), M, CW), (DANA, d(5,24), A, CW), (DANA, d(5,24), N, CW),  # full day off
    (DANA, d(5,25), M, PR),
    (DANA, d(5,28), N, PN),
    (DANA, d(5,29), N, PN),
    (DANA, d(5,30), N, PN),
    (DANA, d(5,31), M, CW), (DANA, d(5,31), A, CW), (DANA, d(5,31), N, CW),  # day off
    (DANA, d(6, 4), M, PR),
    (DANA, d(6, 5), M, PR),
    (DANA, d(6, 7), M, CW), (DANA, d(6, 7), A, CW), (DANA, d(6, 7), N, CW),  # Sat off
    (DANA, d(6, 8), M, CW), (DANA, d(6, 8), A, CW), (DANA, d(6, 8), N, CW),  # Sun off
    (DANA, d(6,11), N, PN),
    (DANA, d(6,12), N, PN),
    (DANA, d(6,13), N, PN),

    # ════════════════ LIHI (23) — 100%, prefers nights ═══════════════════
    (LIHI, d(5,21), N, PR), (LIHI, d(5,21), M, PN),
    (LIHI, d(5,22), N, PR), (LIHI, d(5,22), M, PN),
    (LIHI, d(5,23), N, PR),
    (LIHI, d(5,24), M, PN),
    (LIHI, d(5,25), N, PR),
    (LIHI, d(5,28), N, PR), (LIHI, d(5,28), M, PN),
    (LIHI, d(5,29), N, PR),
    (LIHI, d(5,30), N, PR),
    (LIHI, d(6, 1), M, CW), (LIHI, d(6, 1), A, CW), (LIHI, d(6, 1), N, CW),  # day off
    (LIHI, d(6, 4), N, PR), (LIHI, d(6, 4), M, PN),
    (LIHI, d(6, 5), N, PR),
    (LIHI, d(6, 6), N, PR),
    (LIHI, d(6, 8), M, CW), (LIHI, d(6, 8), A, CW), (LIHI, d(6, 8), N, CW),
    (LIHI, d(6,11), N, PR),
    (LIHI, d(6,12), M, PN),
    (LIHI, d(6,13), N, PR),

    # ════════════════ ORI (24) — 100%, prefers afternoons ════════════════
    (ORI, d(5,21), M, CW),
    (ORI, d(5,21), A, PR),
    (ORI, d(5,22), A, PR),
    (ORI, d(5,23), A, PR),
    (ORI, d(5,25), A, PR),
    (ORI, d(5,26), M, CW), (ORI, d(5,26), A, CW), (ORI, d(5,26), N, CW),
    (ORI, d(5,28), A, PR),
    (ORI, d(5,29), A, PR),
    (ORI, d(5,31), M, CW), (ORI, d(5,31), A, CW), (ORI, d(5,31), N, CW),  # day off
    (ORI, d(6, 4), A, PR),
    (ORI, d(6, 6), M, PR),
    (ORI, d(6, 7), M, PR),
    (ORI, d(6, 9), M, CW), (ORI, d(6, 9), A, CW), (ORI, d(6, 9), N, CW),
    (ORI, d(6,11), A, PR),
    (ORI, d(6,12), A, PR),
    (ORI, d(6,13), M, CW),

    # ════════════════ MICHAL (26) — 50%, part-time mornings ══════════════
    (MICHAL, d(5,21), M, PR),
    (MICHAL, d(5,22), M, PR),
    (MICHAL, d(5,22), N, CW),
    (MICHAL, d(5,23), M, PR),
    (MICHAL, d(5,23), N, CW),
    (MICHAL, d(5,24), M, PR),
    (MICHAL, d(5,25), N, CW),
    (MICHAL, d(5,26), M, CW), (MICHAL, d(5,26), A, CW), (MICHAL, d(5,26), N, CW),
    (MICHAL, d(5,27), M, CW), (MICHAL, d(5,27), A, CW), (MICHAL, d(5,27), N, CW),
    (MICHAL, d(5,28), M, PR),
    (MICHAL, d(5,29), M, PR),
    (MICHAL, d(5,30), N, CW),
    (MICHAL, d(6, 2), M, CW), (MICHAL, d(6, 2), A, CW), (MICHAL, d(6, 2), N, CW),
    (MICHAL, d(6, 3), M, CW), (MICHAL, d(6, 3), A, CW), (MICHAL, d(6, 3), N, CW),
    (MICHAL, d(6, 4), N, CW),
    (MICHAL, d(6, 5), M, PR),
    (MICHAL, d(6, 6), M, PR),
    (MICHAL, d(6, 9), M, CW), (MICHAL, d(6, 9), A, CW), (MICHAL, d(6, 9), N, CW),
    (MICHAL, d(6,10), M, CW), (MICHAL, d(6,10), A, CW), (MICHAL, d(6,10), N, CW),
    (MICHAL, d(6,11), M, PR),
    (MICHAL, d(6,12), M, PR),
    (MICHAL, d(6,13), N, CW),

    # ════════════════ RINA (27) — 80%, prefers afternoons ════════════════
    (RINA, d(5,21), A, PR),
    (RINA, d(5,22), A, PR),
    (RINA, d(5,23), A, PR),
    (RINA, d(5,24), A, PR),
    (RINA, d(5,25), M, PN),
    (RINA, d(5,26), M, CW), (RINA, d(5,26), A, CW), (RINA, d(5,26), N, CW),
    (RINA, d(5,27), M, CW), (RINA, d(5,27), A, CW), (RINA, d(5,27), N, CW),
    (RINA, d(5,28), A, PR),
    (RINA, d(5,29), A, PR),
    (RINA, d(5,30), A, PR),
    (RINA, d(6, 2), M, PN),
    (RINA, d(6, 3), M, PN),
    (RINA, d(6, 4), A, PR),
    (RINA, d(6, 5), A, PR),
    (RINA, d(6, 6), A, PR),
    (RINA, d(6, 8), M, CW), (RINA, d(6, 8), A, CW), (RINA, d(6, 8), N, CW),
    (RINA, d(6,11), A, PR),
    (RINA, d(6,12), A, PR),
    (RINA, d(6,13), A, PR),
]

# ── Leave requests (APPROVED) ─────────────────────────────────────────────────
# Format: (nurse_id, start_date, end_date, reason)
LEAVES = [
    # Maya on approved leave Jun 1-3 (Sun-Tue)
    (MAYA, d(6, 1), d(6, 3), "Personal leave"),
    # Dana takes a day off May 28 (planned)
    (DANA, d(5,28), d(5,28), "Personal day"),
    # Lihi off May 26-27 (Fri-Sat weekend)
    (LIHI, d(5,26), d(5,27), "Weekend leave"),
]


def seed():
    db = SessionLocal()
    try:
        nurse_ids = [MAYA, NOA, SHIRA, TAL, DANA, LIHI, ORI, MICHAL, RINA]

        # ── Wipe existing constraints/leaves for the window ──────────────────
        deleted_c = (
            db.query(ShiftConstraint)
            .filter(
                ShiftConstraint.nurse_id.in_(nurse_ids),
                ShiftConstraint.date >= START,
                ShiftConstraint.date <= END,
            )
            .delete(synchronize_session=False)
        )
        deleted_l = (
            db.query(LeaveRequest)
            .filter(
                LeaveRequest.nurse_id.in_(nurse_ids),
                LeaveRequest.start_date <= END,
                LeaveRequest.end_date >= START,
            )
            .delete(synchronize_session=False)
        )
        db.commit()
        print(f"Cleared {deleted_c} constraints and {deleted_l} leave requests.")

        # ── Insert constraints ────────────────────────────────────────────────
        constraint_count = 0
        for nurse_id, day, shift, ctype in CONSTRAINTS:
            if day < START or day > END:
                continue
            db.add(ShiftConstraint(
                nurse_id=nurse_id,
                date=day,
                shift_type=shift,
                constraint_type=ctype,
            ))
            constraint_count += 1
        db.flush()
        print(f"Inserted {constraint_count} constraints.")

        # ── Insert leave requests ─────────────────────────────────────────────
        leave_count = 0
        for nurse_id, start, end, reason in LEAVES:
            db.add(LeaveRequest(
                nurse_id=nurse_id,
                start_date=start,
                end_date=end,
                reason=reason,
                status=RequestStatus.APPROVED,
            ))
            leave_count += 1
        db.flush()
        print(f"Inserted {leave_count} approved leave requests.")

        db.commit()

        # ── Summary ───────────────────────────────────────────────────────────
        nurse_names = {
            MAYA: "Maya Cohen",
            NOA:  "Noa Levi",
            SHIRA:"Shira Mizrahi",
            TAL:  "Tal Katz",
            DANA: "Dana Peretz",
            LIHI: "Lihi Shapiro",
            ORI:  "Ori Bar",
            MICHAL:"Michal Gold",
            RINA: "Rina Avraham",
        }
        ctype_label = {
            ConstraintType.CANNOT_WORK: "CANNOT_WORK",
            ConstraintType.PREFER:      "PREFER",
            ConstraintType.PREFER_NOT:  "PREFER_NOT",
        }
        print("\n=== Constraint summary per nurse ===")
        for nid, name in nurse_names.items():
            rows = (
                db.query(ShiftConstraint)
                .filter(
                    ShiftConstraint.nurse_id == nid,
                    ShiftConstraint.date >= START,
                    ShiftConstraint.date <= END,
                )
                .order_by(ShiftConstraint.date)
                .all()
            )
            cw = sum(1 for r in rows if r.constraint_type == ConstraintType.CANNOT_WORK)
            pr = sum(1 for r in rows if r.constraint_type == ConstraintType.PREFER)
            pn = sum(1 for r in rows if r.constraint_type == ConstraintType.PREFER_NOT)
            leaves = (
                db.query(LeaveRequest)
                .filter(
                    LeaveRequest.nurse_id == nid,
                    LeaveRequest.start_date <= END,
                    LeaveRequest.end_date >= START,
                    LeaveRequest.status == RequestStatus.APPROVED,
                )
                .all()
            )
            leave_str = ", ".join(f"{l.start_date}→{l.end_date}" for l in leaves) or "none"
            print(f"  {name:15s}: CANNOT={cw:2d}  PREFER={pr:2d}  PREFER_NOT={pn:2d}  leave={leave_str}")

        print("\nDone. Ready to test scheduler for May 21 – Jun 13, 2026.")

    except Exception as e:
        db.rollback()
        print(f"ERROR: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
