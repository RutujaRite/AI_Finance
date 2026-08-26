from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class BankManagerSearchRequest(BaseModel):
    bank_name: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    branch: Optional[str] = None
    manager_name: Optional[str] = None


class BankManagerSearchResponse(BaseModel):
    id: int
    bank_name: str
    manager_name: str
    employee_code: Optional[str] = None
    mobile_no: Optional[str] = None
    email_id: Optional[str] = None
    location_city: Optional[str] = None
    location_district: Optional[str] = None
    state: Optional[str] = None
    branch_name: Optional[str] = None
    branch_code: Optional[str] = None
    designation: Optional[str] = None


class BankManagerSearchResult(BaseModel):
    count: int
    managers: List[BankManagerSearchResponse]
