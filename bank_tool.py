from typing import Optional
from ai_schema import BankManagerSearchRequest


BANK_MANAGER_TOOL = {
    "type": "function",
    "function": {
        "name": "search_bank_manager",
        "description": (
            "Search bank manager contact information from the internal "
            "PostgreSQL database using bank name, city, district, state, branch, or manager name."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "bank_name": {
                    "type": "string",
                    "description": "Bank name such as HDFC, ICICI, Axis Bank, SBI, etc."
                },
                "city": {
                    "type": "string",
                    "description": "City name such as Pune, Mumbai, Delhi, Bangalore, etc."
                },
                "district": {
                    "type": "string",
                    "description": "District name"
                },
                "state": {
                    "type": "string",
                    "description": "State name such as Maharashtra, Karnataka, Delhi, etc."
                },
                "branch": {
                    "type": "string",
                    "description": "Branch name or branch code"
                },
                "manager_name": {
                    "type": "string",
                    "description": "Manager name to search for"
                }
            },
            "required": []
        }
    }
}


BANK_MANAGER_TOOLS = [BANK_MANAGER_TOOL]


def get_bank_manager_tool_definition():
    return BANK_MANAGER_TOOL


def get_bank_manager_tools():
    return BANK_MANAGER_TOOLS


def execute_bank_manager_search(kwargs: dict) -> dict:
    validated = BankManagerSearchRequest(**kwargs)
    from bank_service import search_bank_manager
    return search_bank_manager(
        bank_name=validated.bank_name,
        city=validated.city,
        district=validated.district,
        state=validated.state,
        branch=validated.branch,
        manager_name=validated.manager_name,
    )
