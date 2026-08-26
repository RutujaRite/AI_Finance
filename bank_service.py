from typing import Optional, Dict, Any, List
from ai_schema import BankManagerSearchRequest, BankManagerSearchResponse, BankManagerSearchResult
from bank_db import fetch_bank_managers


def search_bank_manager(
    bank_name: Optional[str] = None,
    city: Optional[str] = None,
    district: Optional[str] = None,
    state: Optional[str] = None,
    branch: Optional[str] = None,
    manager_name: Optional[str] = None,
) -> Dict[str, Any]:
    request = BankManagerSearchRequest(
        bank_name=bank_name,
        city=city,
        district=district,
        state=state,
        branch=branch,
        manager_name=manager_name,
    )

    raw_results = fetch_bank_managers(
        bank_name=request.bank_name,
        city=request.city,
        district=request.district,
        state=request.state,
        branch=request.branch,
        manager_name=request.manager_name,
    )

    validated_managers: List[BankManagerSearchResponse] = []
    for row in raw_results:
        validated_managers.append(BankManagerSearchResponse(**row))

    result = BankManagerSearchResult(
        count=len(validated_managers),
        managers=validated_managers
    )

    return result.dict()
