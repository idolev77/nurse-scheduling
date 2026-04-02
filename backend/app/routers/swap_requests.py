from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import (
    Notification,
    ShiftAssignment,
    SwapRequest,
    SwapRequestStatus,
    User,
)
from app.schemas import SwapRequestCreate, SwapRequestOut

router = APIRouter(prefix="/api/swap-requests", tags=["Swap Requests"])


def _build_out(sr: SwapRequest) -> SwapRequestOut:
    """Populate denormalized fields from relationships."""
    shift = sr.shift_assignment
    dept_name = None
    if shift and shift.schedule and shift.schedule.department:
        dept_name = shift.schedule.department.name

    return SwapRequestOut(
        id=sr.id,
        shift_assignment_id=sr.shift_assignment_id,
        requester_id=sr.requester_id,
        requester_name=(
            f"{sr.requester.first_name} {sr.requester.last_name}" if sr.requester else None
        ),
        claimant_id=sr.claimant_id,
        claimant_name=(
            f"{sr.claimant.first_name} {sr.claimant.last_name}" if sr.claimant else None
        ),
        status=sr.status,
        note=sr.note,
        created_at=sr.created_at,
        shift_date=shift.date if shift else None,
        shift_type=shift.shift_type if shift else None,
        department_name=dept_name,
    )


# ── POST /api/swap-requests  ─ offer a shift for swap ─────────────────────────
@router.post("", response_model=SwapRequestOut, status_code=status.HTTP_201_CREATED)
def offer_shift_for_swap(
    body: SwapRequestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Verify the assignment exists and belongs to the requesting nurse
    assignment = db.query(ShiftAssignment).filter(
        ShiftAssignment.id == body.shift_assignment_id
    ).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Shift assignment not found")
    if assignment.nurse_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only offer your own shifts")

    # Disallow duplicate open offers for the same assignment
    existing = db.query(SwapRequest).filter(
        SwapRequest.shift_assignment_id == body.shift_assignment_id,
        SwapRequest.status == SwapRequestStatus.OPEN,
    ).first()
    if existing:
        raise HTTPException(
            status_code=409, detail="This shift is already offered for swap"
        )

    # The shift must be in the future
    if assignment.date < datetime.utcnow().date():
        raise HTTPException(
            status_code=400, detail="Cannot offer a past shift for swap"
        )

    sr = SwapRequest(
        shift_assignment_id=body.shift_assignment_id,
        requester_id=current_user.id,
        note=body.note,
        status=SwapRequestStatus.OPEN,
    )
    db.add(sr)
    db.commit()
    db.refresh(sr)
    return _build_out(sr)


# ── GET /api/swap-requests  ─ list open offers (marketplace board) ────────────
@router.get("", response_model=List[SwapRequestOut])
def list_open_swap_requests(
    include_mine: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(SwapRequest).filter(SwapRequest.status == SwapRequestStatus.OPEN)
    if not include_mine:
        # By default exclude the nurse's own offerings so board shows only claimable ones
        query = query.filter(SwapRequest.requester_id != current_user.id)
    results = query.order_by(SwapRequest.created_at.desc()).all()
    return [_build_out(sr) for sr in results]


# ── GET /api/swap-requests/mine  ─ my own open offers ────────────────────────
@router.get("/mine", response_model=List[SwapRequestOut])
def list_my_swap_requests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    results = (
        db.query(SwapRequest)
        .filter(SwapRequest.requester_id == current_user.id)
        .order_by(SwapRequest.created_at.desc())
        .all()
    )
    return [_build_out(sr) for sr in results]


# ── POST /api/swap-requests/{id}/claim  ─ claim a swap ───────────────────────
@router.post("/{swap_id}/claim", response_model=SwapRequestOut)
def claim_swap(
    swap_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sr = db.query(SwapRequest).filter(SwapRequest.id == swap_id).first()
    if not sr:
        raise HTTPException(status_code=404, detail="Swap request not found")
    if sr.status != SwapRequestStatus.OPEN:
        raise HTTPException(status_code=409, detail="This swap offer is no longer available")
    if sr.requester_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot claim your own swap offer")

    assignment = sr.shift_assignment

    # Guard: claimant must not already have a shift on the same date + shift_type
    conflict = db.query(ShiftAssignment).filter(
        ShiftAssignment.nurse_id == current_user.id,
        ShiftAssignment.date == assignment.date,
        ShiftAssignment.shift_type == assignment.shift_type,
    ).first()
    if conflict:
        raise HTTPException(
            status_code=409,
            detail="You already have an overlapping shift on that date and shift type",
        )

    # Transfer the shift
    assignment.nurse_id = current_user.id

    # Resolve all other open offers for the same assignment (shouldn't be any, but defensive)
    db.query(SwapRequest).filter(
        SwapRequest.shift_assignment_id == assignment.id,
        SwapRequest.status == SwapRequestStatus.OPEN,
        SwapRequest.id != sr.id,
    ).update({"status": SwapRequestStatus.CANCELLED, "resolved_at": datetime.utcnow()})

    sr.claimant_id = current_user.id
    sr.status = SwapRequestStatus.CLAIMED
    sr.resolved_at = datetime.utcnow()

    # Notify the original requester that their shift was taken
    claimant_name = f"{current_user.first_name} {current_user.last_name}"
    shift_date_str = assignment.date.strftime("%A, %d %b").lstrip("0")
    shift_type_label = assignment.shift_type.value.capitalize()
    notification = Notification(
        user_id=sr.requester_id,
        message=(
            f"Your {shift_type_label} shift on {shift_date_str} "
            f"was claimed by {claimant_name}."
        ),
    )
    db.add(notification)

    db.commit()
    db.refresh(sr)
    return _build_out(sr)


# ── DELETE /api/swap-requests/{id}  ─ cancel own offer ───────────────────────
@router.delete("/{swap_id}", status_code=status.HTTP_204_NO_CONTENT)
def cancel_swap_request(
    swap_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sr = db.query(SwapRequest).filter(SwapRequest.id == swap_id).first()
    if not sr:
        raise HTTPException(status_code=404, detail="Swap request not found")
    if sr.requester_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only cancel your own swap offers")
    if sr.status != SwapRequestStatus.OPEN:
        raise HTTPException(status_code=409, detail="Only open offers can be cancelled")

    sr.status = SwapRequestStatus.CANCELLED
    sr.resolved_at = datetime.utcnow()
    db.commit()


# ── GET /api/swap-requests/count  ─ badge count for dashboard ────────────────
@router.get("/count", response_model=dict)
def open_swap_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    count = (
        db.query(SwapRequest)
        .filter(
            SwapRequest.status == SwapRequestStatus.OPEN,
            SwapRequest.requester_id != current_user.id,
        )
        .count()
    )
    return {"count": count}
