from fastapi import FastAPI

from routes.chat import router as chat_router

app = FastAPI(title="InCraax AI", version="1.0.0")

app.include_router(chat_router)


@app.get("/health")
def health():
    return {"status": "ok"}
