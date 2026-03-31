from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import LeaveRequest, User, RoleEnum, RequestStatus
from app.schemas import LeaveRequestCreate, LeaveRequestOut, LeaveRequestReview
from app.auth import get_current_user, require_role

router = APIRouter(prefix="/api/leave-requests", tags=["Leave Requests"])


@router.get("/", response_model=List[LeaveRequestOut])
def list_leave_requests(
    status: RequestStatus = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(LeaveRequest)
    if current_user.role == RoleEnum.NURSE:
        query = query.filter(LeaveRequest.nurse_id == current_user.id)
    if status:
        query = query.filter(LeaveRequest.status == status)
    return query.all()


@router.post("/", response_model=LeaveRequestOut, status_code=201)
def create_leave_request(
    payload: LeaveRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.end_date < payload.start_date:
        raise HTTPException(status_code=400, detail="End date must be after start date")
    req = LeaveRequest(nurse_id=current_user.id, **payload.dict())
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


@router.put("/{request_id}/review", response_model=LeaveRequestOut)
def review_leave_request(
    request_id: int,
    payload: LeaveRequestReview,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.HEAD_NURSE, RoleEnum.ADMIN)),
):
    req = db.query(LeaveRequest).filter(LeaveRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Leave request not found")
    req.status = payload.status
    req.reviewed_by = current_user.id
    db.commit()
    db.refresh(req)
    return req
