# backend/main.py
import os
import uuid
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from supabase import create_client, Client

# --- load env from backend/.env regardless of CWD ---
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in backend/.env")

# --- single global Supabase client ---
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

# --- health ---
@app.get("/api/health")
def health():
    return {"ok": True}

# --- models ---
class CreateSessionReq(BaseModel):
    teacher_id: str
    question_text: str

class SubmitAnswerReq(BaseModel):
    session_id: str
    board_json: dict
    preview_png_base64: str | None = None
    student_id: str | None = None

# --- sessions ---
class CreateSessionReq(BaseModel):
    teacher_id: str
    question_text: str

@app.post("/api/sessions")
def create_session(req: CreateSessionReq):
    import uuid, traceback
    session_id = str(uuid.uuid4())
    try:
        res = supabase.table("sessions").insert({
            "session_id": session_id,
            "teacher_id": req.teacher_id,
            "question_text": req.question_text
        }).execute()

        if getattr(res, "error", None):
            return JSONResponse({"ok": False, "where": "insert", "error": str(res.error)}, status_code=500)

        return JSONResponse({"ok": True, "session_id": session_id}, status_code=200)

    except Exception as e:
        traceback.print_exc()
        return JSONResponse({"ok": False, "where": "exception", "error": f"{type(e).__name__}: {e}"}, status_code=500)

# --- answers (minimal; no storage yet) ---
@app.post("/api/answers")
def submit_answer(req: SubmitAnswerReq):
    # make sure the session exists
    ses = supabase.table("sessions").select("session_id").eq("session_id", req.session_id).execute()
    if not getattr(ses, "data", None):
        return JSONResponse({"ok": False, "error": "Invalid session_id"}, status_code=400)

    answer_id = str(uuid.uuid4())
    supabase.table("answers").insert({
        "answer_id": answer_id,
        "session_id": req.session_id,
        "board_json": req.board_json,
        "student_id": req.student_id
    }).execute()

    # ALWAYS return JSON (never None)
    return JSONResponse({"ok": True, "answer_id": answer_id, "preview_url": None}, status_code=200)

# --- probes for debugging ---
@app.get("/api/answers/_probe")
def answers_probe():
    return JSONResponse({"probe": "answers-endpoint-v2"}, status_code=200)

@app.get("/api/routes")
def list_routes():
    return [r.path for r in app.router.routes]
