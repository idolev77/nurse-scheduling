from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Department, User, RoleEnum
from app.schemas import DepartmentCreate, DepartmentOut
from app.auth import require_role

router = APIRouter(prefix="/api/departments", tags=["Departments"])


@router.get("/", response_model=List[DepartmentOut])
def list_departments(db: Session = Depends(get_db)):
    return db.query(Department).all()


@router.post("/", response_model=DepartmentOut, status_code=201)
def create_department(
    payload: DepartmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
):
    if db.query(Department).filter(Department.name == payload.name).first():
        raise HTTPException(status_code=400, detail="Department name already exists")
    dept = Department(**payload.dict())
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return dept


@router.put("/{dept_id}", response_model=DepartmentOut)
def update_department(
    dept_id: int,
    payload: DepartmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
):
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    for field, value in payload.dict().items():
        setattr(dept, field, value)
    db.commit()
    db.refresh(dept)
    return dept
