"""
Nurse shift availability — nurses declare which shifts they can work
and their preference level (1 = preferred, 2 = available but not preferred).
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_role
from app.database import get_db
from app.models import (
    NurseShiftAvailability, Shift, User, RoleEnum,
)
from app.schemas import (
    AvailabilityCreate, AvailabilityBulkCreate, AvailabilityOut,
)

router = APIRouter(prefix="/api/availability", tags=["Availability"])


def _to_out(a: NurseShiftAvailability) -> AvailabilityOut:
    """Convert ORM object to response schema with denormalized fields."""
    return AvailabilityOut(
        id=a.id,
        nurse_id=a.nurse_id,
        shift_id=a.shift_id,
        capacity=a.capacity,
        preference_level=a.preference_level,
        nurse_name=(
            f"{a.nurse.first_name} {a.nurse.last_name}" if a.nurse else None
        ),
        shift_date=a.shift.date if a.shift else None,
        shift_type=a.shift.shift_type if a.shift else None,
    )


@router.get("/", response_model=List[AvailabilityOut])
def list_availability(
    shift_id: int = None,
    department_id: int = None,
    week_start: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List availability entries.
    Nurses see only their own; managers see all (filterable).
    """
    query = db.query(NurseShiftAvailability)

    if current_user.role == RoleEnum.NURSE:
        query = query.filter(NurseShiftAvailability.nurse_id == current_user.id)

    if shift_id:
        query = query.filter(NurseShiftAvailability.shift_id == shift_id)

    if department_id or week_start:
        query = query.join(Shift, NurseShiftAvailability.shift_id == Shift.id)
        if department_id:
            query = query.filter(Shift.department_id == department_id)
        if week_start:
            from datetime import date, timedelta
            ws = date.fromisoformat(week_start)
            we = ws + timedelta(days=6)
            query = query.filter(Shift.date >= ws, Shift.date <= we)

    rows = query.all()
    return [_to_out(r) for r in rows]


@router.post("/", response_model=AvailabilityOut, status_code=201)
def submit_availability(
    payload: AvailabilityCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Submit or update availability for a single shift."""
    shift = db.query(Shift).filter(Shift.id == payload.shift_id).first()
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")

    # Upsert: update if exists, create if not
    existing = (
        db.query(NurseShiftAvailability)
        .filter(
            NurseShiftAvailability.nurse_id == current_user.id,
            NurseShiftAvailability.shift_id == payload.shift_id,
        )
        .first()
    )
    if existing:
        existing.capacity = payload.capacity
        existing.preference_level = payload.preference_level
        db.commit()
        db.refresh(existing)
        return _to_out(existing)

    avail = NurseShiftAvailability(
        nurse_id=current_user.id,
        shift_id=payload.shift_id,
        capacity=payload.capacity,
        preference_level=payload.preference_level,
    )
    db.add(avail)
    db.commit()
    db.refresh(avail)
    return _to_out(avail)


@router.post("/bulk", response_model=List[AvailabilityOut], status_code=201)
def submit_bulk_availability(
    payload: AvailabilityBulkCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Bulk-submit availability for multiple shifts at once (upsert)."""
    results = []
    for item in payload.items:
        shift = db.query(Shift).filter(Shift.id == item.shift_id).first()
        if not shift:
            continue

        existing = (
            db.query(NurseShiftAvailability)
            .filter(
                NurseShiftAvailability.nurse_id == current_user.id,
                NurseShiftAvailability.shift_id == item.shift_id,
            )
            .first()
        )
        if existing:
            existing.capacity = item.capacity
            existing.preference_level = item.preference_level
            results.append(existing)
        else:
            avail = NurseShiftAvailability(
                nurse_id=current_user.id,
                shift_id=item.shift_id,
                capacity=item.capacity,
                preference_level=item.preference_level,
            )
            db.add(avail)
            results.append(avail)

    db.commit()
    for r in results:
        db.refresh(r)
    return [_to_out(r) for r in results]


@router.delete("/{avail_id}", status_code=204)
def delete_availability(
    avail_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove an availability entry."""
    avail = db.query(NurseShiftAvailability).filter(
        NurseShiftAvailability.id == avail_id
    ).first()
    if not avail:
        raise HTTPException(status_code=404, detail="Availability entry not found")
    if current_user.role == RoleEnum.NURSE and avail.nurse_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your availability entry")
    db.delete(avail)
    db.commit()
