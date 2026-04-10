"""
Smart Scheduling Algorithm for Nurse Shift Assignment.

Uses a Min-Cost Max-Flow (MCMF) network model wrapped in an
iterative optimisation loop:

1. Collect nurses, shifts, availability, and hard blocks from the DB.
2. Run ``iterations`` rounds.  In each round the input is lightly
   randomised (shuffled order + probabilistic edge-dropping) so that
   NetworkX breaks ties differently.
3. Every candidate solution is scored by ``evaluate_schedule`` which
   rewards filled quotas & preferred assignments and penalises high
   utilisation-variance among nurses.
4. The highest-scoring solution is persisted to the database.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Dict, List, Set, Tuple

import networkx as nx
from sqlalchemy.orm import Session

from app.models import (
    User, Department, ShiftConstraint, LeaveRequest, ShiftAssignment,
    Schedule, Shift,
    ShiftType, ConstraintType, RequestStatus, RoleEnum,
)

# ────────────────────────────────────────────────────────────
#  Small data-classes used inside the algorithm (not ORM)
# ────────────────────────────────────────────────────────────

@dataclass
class _AvailEdge:
    """One availability record, free of ORM state."""
    nurse_id: int
    shift_id: int
    capacity: int
    preference_level: int          # 1 = preferred, 2 = available


@dataclass
class _ShiftInfo:
    """Lightweight copy of a Shift row."""
    id: int
    date: date
    shift_type: ShiftType
    required_staff: int


@dataclass
class _NurseInfo:
    """Lightweight copy of a User row."""
    id: int
    employment_percentage: int


@dataclass
class _CandidateResult:
    """Result of a single flow solve (no DB objects)."""
    assignments: List[dict] = field(default_factory=list)
    warnings: List[str]     = field(default_factory=list)
    total_required: int     = 0
    total_assigned: int     = 0
    score: float            = -math.inf


# ────────────────────────────────────────────────────────────
#  Helper: nurse weekly capacity
# ────────────────────────────────────────────────────────────

def _nurse_capacity(employment_percentage: int) -> int:
    """Max shifts per week based on employment percentage."""
    return max(1, round((employment_percentage / 100) * 6))


# ────────────────────────────────────────────────────────────
#  1. Scoring function
# ────────────────────────────────────────────────────────────

# Tunable weights
_W_FILLED_SLOT   =  100     # bonus per filled slot
_W_UNFILLED_SLOT = -200     # penalty per unfilled slot
_W_PREF1_BONUS   =   10     # bonus per preferred assignment
_W_VARIANCE_PEN  = - 50     # penalty multiplier for utilisation variance


def evaluate_schedule(
    candidate: _CandidateResult,
    shifts: List[_ShiftInfo],
    nurses: List[_NurseInfo],
    avail_edges: List[_AvailEdge],
) -> float:
    """
    Return a numeric quality score for a candidate schedule.

    Components
    ----------
    * **Quota bonus/penalty** – massive reward for every filled slot,
      heavy penalty for every unfilled one.
    * **Preference bonus** – reward when a nurse is placed in a shift
      they marked as *Preferred* (level 1).
    * **Fairness** – penalise high variance in per-nurse utilisation
      rates so that shifts are spread evenly.
    """

    score: float = 0.0

    # --- quota component ---
    score += candidate.total_assigned * _W_FILLED_SLOT
    unfilled = candidate.total_required - candidate.total_assigned
    score += unfilled * _W_UNFILLED_SLOT

    # --- preference component ---
    # Build a fast lookup: (nurse_id, shift_id) -> preference_level
    pref_lookup: Dict[Tuple[int, int], int] = {
        (e.nurse_id, e.shift_id): e.preference_level for e in avail_edges
    }
    # Build reverse map: (date, shift_type) -> shift_id
    shift_id_lookup: Dict[Tuple[date, str], int] = {
        (s.date, s.shift_type): s.id for s in shifts
    }

    for a in candidate.assignments:
        sid = shift_id_lookup.get((a["date"], a["shift_type"]))
        if sid is not None and pref_lookup.get((a["nurse_id"], sid)) == 1:
            score += _W_PREF1_BONUS

    # --- fairness / variance component ---
    nurse_caps = {n.id: _nurse_capacity(n.employment_percentage) for n in nurses}
    nurse_assigned: Dict[int, int] = {n.id: 0 for n in nurses}
    for a in candidate.assignments:
        nurse_assigned[a["nurse_id"]] = nurse_assigned.get(a["nurse_id"], 0) + 1

    utilisation_rates: List[float] = []
    for nid, cap in nurse_caps.items():
        utilisation_rates.append(nurse_assigned.get(nid, 0) / cap if cap else 0.0)

    if len(utilisation_rates) >= 2:
        mean_u = sum(utilisation_rates) / len(utilisation_rates)
        variance = sum((u - mean_u) ** 2 for u in utilisation_rates) / len(utilisation_rates)
        score += _W_VARIANCE_PEN * variance

    return score


# ────────────────────────────────────────────────────────────
#  2. Input randomiser
# ────────────────────────────────────────────────────────────

_DROP_PROB_PREF2 = 0.10   # probability to drop a preference-2 edge


def _randomise_inputs(
    nurses: List[_NurseInfo],
    shifts: List[_ShiftInfo],
    avail_edges: List[_AvailEdge],
) -> Tuple[List[_NurseInfo], List[_ShiftInfo], List[_AvailEdge]]:
    """
    Return shuffled copies of the input lists.  Additionally, each
    preference-2 availability edge has a small probability of being
    dropped so that the solver is forced to explore alternative paths.
    """
    r_nurses = list(nurses)
    random.shuffle(r_nurses)

    r_shifts = list(shifts)
    random.shuffle(r_shifts)

    r_avail: List[_AvailEdge] = []
    for e in avail_edges:
        if e.preference_level == 2 and random.random() < _DROP_PROB_PREF2:
            continue          # drop this "available-if-needed" edge
        r_avail.append(e)
    random.shuffle(r_avail)

    return r_nurses, r_shifts, r_avail


# ────────────────────────────────────────────────────────────
#  3. Hard-constraint detection & iterative repair
# ────────────────────────────────────────────────────────────

_MAX_REPAIR_ROUNDS = 10


def _detect_constraint_violations(
    assignments: List[dict],
    week_start: date,
    week_end: date,
) -> Set[Tuple[int, date, ShiftType]]:
    """
    Scan *assignments* for labour-law violations and return a set of
    ``(nurse_id, date, shift_type)`` tuples that must be blocked to
    restore feasibility.

    Hard constraints enforced
    -------------------------
    1. **24-h rest after Night**: cannot work Morning or Afternoon
       the following day.
    2. **8-h rest after Afternoon**: cannot work Morning the following
       day.
    3. **Max 6 consecutive work-days**: the 7th+ day in any
       uninterrupted sequence is blocked.
    4. **Max 2 night shifts per week** per nurse.
    5. **Max 2 consecutive night shifts**: the 3rd+ consecutive night
       is blocked.
    """
    blocks: Set[Tuple[int, date, ShiftType]] = set()

    # Group by nurse
    nurse_asgn: Dict[int, List[dict]] = {}
    for a in assignments:
        nurse_asgn.setdefault(a["nurse_id"], []).append(a)

    for nid, asgns in nurse_asgn.items():
        # day -> set of shift types worked
        day_types: Dict[date, Set[ShiftType]] = {}
        for a in asgns:
            day_types.setdefault(a["date"], set()).add(a["shift_type"])

        # ── 1. 24-h rest after Night ──────────────────────
        for d, types in day_types.items():
            if ShiftType.NIGHT in types:
                nxt = d + timedelta(days=1)
                if nxt <= week_end:
                    nxt_types = day_types.get(nxt, set())
                    if ShiftType.MORNING in nxt_types:
                        blocks.add((nid, nxt, ShiftType.MORNING))
                    if ShiftType.AFTERNOON in nxt_types:
                        blocks.add((nid, nxt, ShiftType.AFTERNOON))

        # ── 2. 8-h rest after Afternoon ──────────────────
        for d, types in day_types.items():
            if ShiftType.AFTERNOON in types:
                nxt = d + timedelta(days=1)
                if nxt <= week_end:
                    if ShiftType.MORNING in day_types.get(nxt, set()):
                        blocks.add((nid, nxt, ShiftType.MORNING))

        # ── 3. Max 6 consecutive work-days ───────────────
        sorted_days = sorted(day_types.keys())
        if sorted_days:
            run_start = 0
            for i in range(1, len(sorted_days)):
                if sorted_days[i] != sorted_days[i - 1] + timedelta(days=1):
                    run_start = i
                elif i - run_start + 1 > 6:
                    for st in ShiftType:
                        blocks.add((nid, sorted_days[i], st))

        # ── 4. Max 2 night shifts per week ───────────────
        night_days = sorted(
            d for d, types in day_types.items() if ShiftType.NIGHT in types
        )
        if len(night_days) > 2:
            for d in night_days[2:]:
                blocks.add((nid, d, ShiftType.NIGHT))

        # ── 5. Max 2 consecutive nights ──────────────────
        for i in range(2, len(night_days)):
            if (night_days[i] == night_days[i - 1] + timedelta(days=1)
                    and night_days[i - 1] == night_days[i - 2] + timedelta(days=1)):
                blocks.add((nid, night_days[i], ShiftType.NIGHT))

    return blocks


def _solve_with_constraints(
    nurses: List[_NurseInfo],
    shifts: List[_ShiftInfo],
    avail_edges: List[_AvailEdge],
    hard_blocks: Set[Tuple[int, date, ShiftType]],
    shift_map: Dict[int, _ShiftInfo],
    week_start: date,
    week_end: date,
) -> _CandidateResult:
    """
    Repeatedly solve the flow network, adding hard-constraint blocks
    after each round until no violations remain (or the repair budget
    is exhausted).
    """
    current_blocks = set(hard_blocks)
    candidate = _CandidateResult()

    for _ in range(_MAX_REPAIR_ROUNDS):
        candidate = _solve_once(
            nurses, shifts, avail_edges, current_blocks, shift_map,
        )
        violations = _detect_constraint_violations(
            candidate.assignments, week_start, week_end,
        )
        if not violations:
            break
        current_blocks |= violations
    else:
        candidate.warnings.append(
            "Hard-constraint repair did not fully converge within "
            f"{_MAX_REPAIR_ROUNDS} rounds."
        )

    return candidate


# ────────────────────────────────────────────────────────────
#  4. Single-iteration flow solve (pure, no DB)
# ────────────────────────────────────────────────────────────

def _solve_once(
    nurses: List[_NurseInfo],
    shifts: List[_ShiftInfo],
    avail_edges: List[_AvailEdge],
    hard_blocks: Set[Tuple[int, date, ShiftType]],
    shift_map: Dict[int, _ShiftInfo],
) -> _CandidateResult:
    """Build the flow network, solve, and return a _CandidateResult."""

    G = nx.DiGraph()
    SOURCE = "S"
    SINK = "T"

    # Source -> Nurse edges
    for nurse in nurses:
        node = f"nurse_{nurse.id}"
        cap = _nurse_capacity(nurse.employment_percentage)
        G.add_edge(SOURCE, node, capacity=cap, weight=0)

    # Nurse -> Shift edges
    for avail in avail_edges:
        shift = shift_map.get(avail.shift_id)
        if not shift:
            continue
        if (avail.nurse_id, shift.date, shift.shift_type) in hard_blocks:
            continue
        nurse_node = f"nurse_{avail.nurse_id}"
        shift_node = f"shift_{avail.shift_id}"
        # preference_level: 1=prefer (cost 0), 2=neutral (cost 1), 3=prefer_not (cost 2)
        cost = avail.preference_level - 1
        G.add_edge(nurse_node, shift_node, capacity=avail.capacity, weight=cost)

    # Shift -> Sink edges
    for shift in shifts:
        shift_node = f"shift_{shift.id}"
        G.add_edge(shift_node, SINK, capacity=shift.required_staff, weight=0)

    # Solve
    try:
        flow_dict = nx.max_flow_min_cost(G, SOURCE, SINK)
    except nx.NetworkXUnfeasible:
        flow_dict = {}

    # Extract assignments
    raw_assignments: List[dict] = []
    for nurse_node, targets in flow_dict.items():
        if not nurse_node.startswith("nurse_"):
            continue
        nurse_id = int(nurse_node.split("_", 1)[1])
        for shift_node, flow_val in targets.items():
            if flow_val > 0 and shift_node.startswith("shift_"):
                shift_id = int(shift_node.split("_", 1)[1])
                s = shift_map[shift_id]
                raw_assignments.append({
                    "nurse_id": nurse_id,
                    "date": s.date,
                    "shift_type": s.shift_type,
                })

    # Warnings
    warnings: List[str] = []
    total_required = 0
    total_assigned = 0
    for shift in shifts:
        shift_node = f"shift_{shift.id}"
        filled = 0
        for nurse_node, targets in flow_dict.items():
            if nurse_node.startswith("nurse_"):
                filled += targets.get(shift_node, 0)
        total_required += shift.required_staff
        total_assigned += filled
        if filled < shift.required_staff:
            warnings.append(
                f"{shift.date.isoformat()} {shift.shift_type.value}: "
                f"assigned {filled}/{shift.required_staff}"
            )

    return _CandidateResult(
        assignments=raw_assignments,
        warnings=warnings,
        total_required=total_required,
        total_assigned=total_assigned,
    )


# ────────────────────────────────────────────────────────────
#  5. Public entry-point (called by the router)
# ────────────────────────────────────────────────────────────

_DEFAULT_ITERATIONS = 50


def generate_schedule(
    db: Session,
    department_id: int,
    week_start: date,
    iterations: int = _DEFAULT_ITERATIONS,
) -> Tuple["Schedule", List[str], int, int]:
    """
    Generate a weekly schedule using iterative Min-Cost Max-Flow.

    Runs *iterations* rounds with light input randomisation, scores
    each candidate, and persists only the best one.

    Returns ``(schedule, warnings, total_required, total_assigned)``.
    """

    # ── Validate & fetch data from DB ──────────────────
    department = db.query(Department).filter(Department.id == department_id).first()
    if not department:
        raise ValueError("Department not found")

    nurses_orm = (
        db.query(User)
        .filter(
            User.department_id == department_id,
            User.is_active == True,
            User.role == RoleEnum.NURSE,
        )
        .all()
    )
    if not nurses_orm:
        raise ValueError("No active nurses in department")

    nurse_ids = [n.id for n in nurses_orm]
    week_end = week_start + timedelta(days=6)

    shifts_orm = (
        db.query(Shift)
        .filter(
            Shift.department_id == department_id,
            Shift.date >= week_start,
            Shift.date <= week_end,
        )
        .all()
    )
    if not shifts_orm:
        raise ValueError(
            "No shifts prepared for this week. "
            "Please prepare shifts before generating a schedule."
        )

    # ── Build lightweight copies (detached from session) ──
    nurses: List[_NurseInfo] = [
        _NurseInfo(id=n.id, employment_percentage=n.employment_percentage)
        for n in nurses_orm
    ]
    shifts: List[_ShiftInfo] = [
        _ShiftInfo(id=s.id, date=s.date, shift_type=s.shift_type,
                   required_staff=s.required_staff)
        for s in shifts_orm
    ]
    shift_map: Dict[int, _ShiftInfo] = {s.id: s for s in shifts}

    # Hard blocks
    hard_blocks: Set[Tuple[int, date, ShiftType]] = set()

    constraints = (
        db.query(ShiftConstraint)
        .filter(
            ShiftConstraint.nurse_id.in_(nurse_ids),
            ShiftConstraint.date >= week_start,
            ShiftConstraint.date <= week_end,
            ShiftConstraint.constraint_type == ConstraintType.CANNOT_WORK,
        )
        .all()
    )
    for c in constraints:
        hard_blocks.add((c.nurse_id, c.date, c.shift_type))

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
            for st in ShiftType:
                hard_blocks.add((leave.nurse_id, d, st))
            d += timedelta(days=1)

    # Build availability edges from constraints only.
    # Default: every nurse is available for every shift (preference_level=2, cost=1).
    # PREFER constraint  → preference_level=1 (cost=0, algorithm favours)
    # PREFER_NOT constraint → preference_level=3 (cost=2, algorithm avoids)
    # CANNOT_WORK is already in hard_blocks and will be filtered in _solve_once.

    soft_constraints = (
        db.query(ShiftConstraint)
        .filter(
            ShiftConstraint.nurse_id.in_(nurse_ids),
            ShiftConstraint.date >= week_start,
            ShiftConstraint.date <= week_end,
            ShiftConstraint.constraint_type.in_([
                ConstraintType.PREFER,
                ConstraintType.PREFER_NOT,
            ]),
        )
        .all()
    )

    # Map (nurse_id, date, shift_type) -> preference_level override
    pref_override: Dict[Tuple[int, date, ShiftType], int] = {}
    for c in soft_constraints:
        level = 1 if c.constraint_type == ConstraintType.PREFER else 3
        pref_override[(c.nurse_id, c.date, c.shift_type)] = level

    avail_edges: List[_AvailEdge] = []
    for nurse in nurses:
        for shift in shifts:
            level = pref_override.get((nurse.id, shift.date, shift.shift_type), 2)
            avail_edges.append(
                _AvailEdge(
                    nurse_id=nurse.id,
                    shift_id=shift.id,
                    capacity=1,
                    preference_level=level,
                )
            )

    # ── Iterative optimisation loop ────────────────────
    best: _CandidateResult = _CandidateResult()   # score = -inf
    iteration_logs: List[dict] = []
    best_idx: int = 0

    for i in range(iterations):
        r_nurses, r_shifts, r_avail = _randomise_inputs(nurses, shifts, avail_edges)

        candidate = _solve_with_constraints(
            r_nurses, r_shifts, r_avail, hard_blocks, shift_map,
            week_start, week_end,
        )
        candidate.score = evaluate_schedule(candidate, shifts, nurses, avail_edges)

        iteration_logs.append({
            "iteration": i + 1,
            "score": round(candidate.score, 2),
            "assigned": candidate.total_assigned,
            "required": candidate.total_required,
            "is_best": False,
        })

        if candidate.score > best.score:
            best = candidate
            best_idx = i

    # Mark the winning iteration
    if iteration_logs:
        iteration_logs[best_idx]["is_best"] = True

    # ── Persist winning schedule to DB ─────────────────
    existing = (
        db.query(Schedule)
        .filter(
            Schedule.department_id == department_id,
            Schedule.week_start_date == week_start,
        )
        .first()
    )
    if existing:
        if existing.is_published:
            raise ValueError(
                "A published schedule already exists for this week. "
                "You cannot regenerate a published schedule."
            )
        db.delete(existing)
        db.flush()

    schedule = Schedule(department_id=department_id, week_start_date=week_start)
    db.add(schedule)
    db.flush()

    for a in best.assignments:
        db.add(ShiftAssignment(schedule_id=schedule.id, **a))

    db.commit()
    db.refresh(schedule)
    return schedule, best.warnings, best.total_required, best.total_assigned, iteration_logs
