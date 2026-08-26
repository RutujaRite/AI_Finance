from ai_agent import run_ai_agent


def get_chat_response(user_message: str) -> str:
    return run_ai_agent(user_message)
