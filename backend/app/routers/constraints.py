from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import ShiftConstraint, User, RoleEnum
from app.schemas import ShiftConstraintCreate, ShiftConstraintOut
from app.auth import get_current_user, require_role

router = APIRouter(prefix="/api/constraints", tags=["Shift Constraints"])


@router.get("/", response_model=List[ShiftConstraintOut])
def list_constraints(
    nurse_id: int = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(ShiftConstraint)
    if current_user.role == RoleEnum.NURSE:
        query = query.filter(ShiftConstraint.nurse_id == current_user.id)
    elif nurse_id:
        query = query.filter(ShiftConstraint.nurse_id == nurse_id)
    return query.all()


@router.post("/", response_model=ShiftConstraintOut, status_code=201)
def create_constraint(
    payload: ShiftConstraintCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    constraint = ShiftConstraint(nurse_id=current_user.id, **payload.dict())
    db.add(constraint)
    db.commit()
    db.refresh(constraint)
    return constraint


@router.delete("/{constraint_id}", status_code=204)
def delete_constraint(
    constraint_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    constraint = db.query(ShiftConstraint).filter(ShiftConstraint.id == constraint_id).first()
    if not constraint:
        raise HTTPException(status_code=404, detail="Constraint not found")
    if current_user.role == RoleEnum.NURSE and constraint.nurse_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your constraint")
    db.delete(constraint)
    db.commit()
