import json
import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from openai import OpenAI

from bank_tool import BANK_MANAGER_TOOLS, execute_bank_manager_search

_ENV_PATH = Path(__file__).resolve().parent / ".env"
load_dotenv(_ENV_PATH)

OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY")
if not OPENROUTER_API_KEY or OPENROUTER_API_KEY == "your_openrouter_api_key_here":
    raise RuntimeError("Set OPENROUTER_API_KEY environment variable")
OPENROUTER_MODEL = os.environ.get("OPENROUTER_MODEL", "openai/gpt-4o-mini")

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=OPENROUTER_API_KEY,
)


SYSTEM_PROMPT = """
You are a banking and loan assistant for InCraax AI.

You have access to an internal bank manager database through the search_bank_manager tool.

When the user asks about:
- bank manager
- branch manager
- manager contact
- manager mobile number
- manager email
- manager in a specific city
- manager in a specific branch
- any bank contact details

Use the search_bank_manager tool to find real data.

Never invent manager information.

If the database does not contain the requested manager,
clearly tell the user that no matching record was found.
"""


def _extract_text(response) -> str:
    return response.choices[0].message.content or ""


def run_ai_agent(user_message: str, model: Optional[str] = None) -> str:
    model_name = model or OPENROUTER_MODEL
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_message},
    ]

    response = client.chat.completions.create(
        model=model_name,
        messages=messages,
        tools=BANK_MANAGER_TOOLS,
        tool_choice="auto",
        max_tokens=1024,
    )

    message = response.choices[0].message

    while message.tool_calls:
        messages.append(message)

        for tool_call in message.tool_calls:
            if tool_call.function.name == "search_bank_manager":
                arguments = json.loads(tool_call.function.arguments or "{}")
                result = execute_bank_manager_search(arguments)
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": json.dumps(result, default=str),
                })
            else:
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": "Unknown function",
                })

        response = client.chat.completions.create(
            model=model_name,
            messages=messages,
            tools=BANK_MANAGER_TOOLS,
            tool_choice="auto",
            max_tokens=1024,
        )
        message = response.choices[0].message

    return _extract_text(response)


if __name__ == "__main__":
    queries = [
        "Give me ICICI bank manager phone numbers for Pune",
        "Find me SBI bank managers in Mumbai",
        "Show me all bank managers in Maharashtra",
    ]

    for query in queries:
        print(f"\nUser: {query}")
        answer = run_ai_agent(query)
        print(f"Assistant: {answer}")
