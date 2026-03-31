from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, RoleEnum
from app.schemas import UserOut, UserUpdate
from app.auth import get_current_user, require_role

router = APIRouter(prefix="/api/users", tags=["Users"])


@router.get("/", response_model=List[UserOut])
def list_users(
    department_id: int = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.HEAD_NURSE, RoleEnum.ADMIN)),
):
    query = db.query(User)
    if department_id:
        query = query.filter(User.department_id == department_id)
    return query.all()


@router.get("/{user_id}", response_model=UserOut)
def get_user(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.put("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    for field, value in payload.dict(exclude_unset=True).items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user
