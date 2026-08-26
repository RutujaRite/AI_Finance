from fastapi import APIRouter
from pydantic import BaseModel

from services.ai_agent import get_chat_response

router = APIRouter(prefix="/api", tags=["AI"])


class ChatRequest(BaseModel):
    message: str


@router.post("/chat")
def chat(request: ChatRequest):
    answer = get_chat_response(request.message)
    return {
        "success": True,
        "answer": answer,
    }
