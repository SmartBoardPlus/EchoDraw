# backend/main.py
import os
import uuid
import base64
from pathlib import Path
from typing import Optional, Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from supabase import create_client, Client

# ------------------------------
# Environment / Supabase client
# ------------------------------
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in backend/.env")

BUCKET = os.environ.get("SUPABASE_BUCKET", "answer_previews")  # must exist (public) if you use previews

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ------------------------------
# App / CORS
# ------------------------------
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

# ------------------------------
# Health / debug
# ------------------------------
@app.get("/api/health")
def health():
    return {"ok": True}

@app.get("/api/answers/_probe")
def answers_probe():
    return JSONResponse({"probe": "answers-endpoint-v3"}, status_code=200)

@app.get("/api/routes")
def list_routes():
    return [r.path for r in app.router.routes]

# ------------------------------
# Models
# ------------------------------
class CreateTeacherReq(BaseModel):
    display_name: Optional[str] = None
    email: Optional[str] = None

class CreateSessionReq(BaseModel):
    teacher_id: str
    session_name: str
    # backward-compat: if provided, we will also create an initial question and set it current
    question_text: Optional[str] = None

class CreateQuestionReq(BaseModel):
    session_id: str
    question_text: str

class SetCurrentQuestionReq(BaseModel):
    question_id: str

class SubmitAnswerReq(BaseModel):
    session_id: str
    board_json: dict
    question_id: Optional[str] = None
    preview_png_base64: Optional[str] = None
    student_id: Optional[str] = None

# ------------------------------
# Helpers
# ------------------------------
def _get_session(session_id: str) -> Optional[dict[str, Any]]:
    r = supabase.table("sessions").select("session_id,current_question_id").eq("session_id", session_id).execute()
    data = r.data or []
    return data[0] if data else None

def _get_question(question_id: str) -> Optional[dict[str, Any]]:
    r = supabase.table("questions").select("question_id,session_id,question_text").eq("question_id", question_id).execute()
    data = r.data or []
    return data[0] if data else None

# ------------------------------
# Teachers
# ------------------------------
@app.post("/api/teachers")
def create_teacher(req: CreateTeacherReq):
    # TEXT teacher_id to match your schema
    teacher_id = str(uuid.uuid4())
    try:
        supabase.table("teachers").insert({
            "teacher_id": teacher_id,
            "display_name": req.display_name,
            "email": req.email
        }).execute()
        return {"ok": True, "teacher_id": teacher_id}
    except Exception as e:
        return JSONResponse({"ok": False, "error": f"{type(e).__name__}: {e}"}, status_code=500)

# ------------------------------
# Sessions
# ------------------------------
@app.post("/api/sessions")
def create_session(req: CreateSessionReq):
    """
    Creates a session with a name and teacher_id.
    Backward-compat with your original 'question_text NOT NULL' by providing a placeholder if none.
    If question_text is provided, we also create an initial question and set it current.
    """
    session_id = str(uuid.uuid4())

    # Your original schema requires sessions.question_text NOT NULL.
    # Use provided question_text, or a harmless placeholder so the insert doesn't fail.
    initial_q_text = req.question_text or "(session created)"

    try:
        # 1) Insert session (also includes new session_name column)
        ins = supabase.table("sessions").insert({
            "session_id": session_id,
            "teacher_id": req.teacher_id,
            "question_text": initial_q_text,  # keep legacy NOT NULL satisfied
            "session_name": req.session_name
        }).execute()
        if getattr(ins, "error", None):
            return JSONResponse({"ok": False, "where": "insert_session", "error": str(ins.error)}, status_code=500)

        current_question_id = None

        # 2) If a real question_text was provided, create a question and set it current
        if req.question_text:
            qid = str(uuid.uuid4())
            qins = supabase.table("questions").insert({
                "question_id": qid,
                "session_id": session_id,
                "question_text": req.question_text
            }).execute()
            if getattr(qins, "error", None):
                return JSONResponse({"ok": False, "where": "insert_question", "error": str(qins.error)}, status_code=500)

            u = supabase.table("sessions").update({
                "current_question_id": qid
            }).eq("session_id", session_id).execute()
            current_question_id = qid

        return {"ok": True, "session_id": session_id, "current_question_id": current_question_id}
    except Exception as e:
        return JSONResponse({"ok": False, "where": "exception", "error": f"{type(e).__name__}: {e}"}, status_code=500)

# ------------------------------
# Questions
# ------------------------------
@app.post("/api/questions")
def create_question(req: CreateQuestionReq):
    # verify session exists
    ses = _get_session(req.session_id)
    if not ses:
        return JSONResponse({"ok": False, "error": "Invalid session_id"}, status_code=400)

    question_id = str(uuid.uuid4())
    try:
        qins = supabase.table("questions").insert({
            "question_id": question_id,
            "session_id": req.session_id,
            "question_text": req.question_text
        }).execute()
        if getattr(qins, "error", None):
            return JSONResponse({"ok": False, "where": "insert_question", "error": str(qins.error)}, status_code=500)
        return {"ok": True, "question_id": question_id}
    except Exception as e:
        return JSONResponse({"ok": False, "where": "exception", "error": f"{type(e).__name__}: {e}"}, status_code=500)

@app.post("/api/sessions/{session_id}/current_question")
def set_current_question(session_id: str, req: SetCurrentQuestionReq):
    # validate both session and question
    ses = _get_session(session_id)
    if not ses:
        return JSONResponse({"ok": False, "error": "Invalid session_id"}, status_code=400)

    q = _get_question(req.question_id)
    if not q or q["session_id"] != session_id:
        return JSONResponse({"ok": False, "error": "Invalid question_id for this session"}, status_code=400)

    try:
        supabase.table("sessions").update({"current_question_id": req.question_id}).eq("session_id", session_id).execute()
        return {"ok": True}
    except Exception as e:
        return JSONResponse({"ok": False, "where": "update_current", "error": f"{type(e).__name__}: {e}"}, status_code=500)

@app.get("/api/sessions/{session_id}/current_question")
def get_current_question(session_id: str):
    r = supabase.table("sessions").select("current_question_id").eq("session_id", session_id).execute()
    data = r.data or []
    if not data:
        return JSONResponse({"ok": False, "error": "Invalid session_id"}, status_code=400)
    cqid = data[0].get("current_question_id")
    if not cqid:
        return JSONResponse({"ok": True, "question": None})

    q = supabase.table("questions").select("question_id,question_text,created_at").eq("question_id", cqid).execute()
    qd = q.data or []
    if not qd:
        return {"ok": True, "question": None}
    return {"ok": True, "question": qd[0]}

@app.get("/api/sessions/{session_id}/questions")
def list_questions(session_id: str):
    r = supabase.table("questions").select("question_id,question_text,created_at").eq("session_id", session_id).order("created_at").execute()
    return r.data or []

# ------------------------------
# Answers
# ------------------------------
@app.get("/api/questions/{question_id}/answers")
def list_answers_for_question(question_id: str):
    r = supabase.table("answers").select("answer_id,preview_url,created_at").eq("question_id", question_id).order("created_at").execute()
    return r.data or []

@app.get("/api/answers/{answer_id}")
def get_answer(answer_id: str):
    r = supabase.table("answers").select("board_json").eq("answer_id", answer_id).execute()
    d = r.data or []
    if not d:
        raise HTTPException(404, "Not found")
    return d[0]

@app.get("/api/questions/{question_id}/answers/shuffled")
def shuffled_answers(question_id: str):
    r = supabase.table("answers").select("answer_id").eq("question_id", question_id).execute()
    ids = [row["answer_id"] for row in (r.data or [])]
    import random
    random.shuffle(ids)
    return {"order": ids}

@app.post("/api/answers")
def submit_answer(req: SubmitAnswerReq):
    """
    Students submit an answer.
    - If question_id omitted, we use the session's current_question_id (backward-compat).
    - Optionally upload preview to Storage and store preview_url.
    Always returns: { ok, answer_id, preview_url }
    """
    ses = _get_session(req.session_id)
    if not ses:
        return JSONResponse({"ok": False, "error": "Invalid session_id"}, status_code=400)

    qid = req.question_id or ses.get("current_question_id")
    if not qid:
        return JSONResponse({"ok": False, "error": "No current question for this session"}, status_code=400)

    # ensure question belongs to session
    q = _get_question(qid)
    if not q or q["session_id"] != req.session_id:
        return JSONResponse({"ok": False, "error": "question_id does not belong to session"}, status_code=400)

    answer_id = str(uuid.uuid4())
    preview_url = None

    # Optional preview upload
    if req.preview_png_base64:
        try:
            raw = base64.b64decode(req.preview_png_base64)
            path = f"{req.session_id}/{answer_id}.png"
            supabase.storage.from_(BUCKET).upload(path, raw, {"content-type": "image/png", "upsert": True})
            preview_url = supabase.storage.from_(BUCKET).get_public_url(path)
        except Exception as e:
            # continue without preview, but report if you like
            print("STORAGE UPLOAD ERROR:", e)

    # Insert answer (now includes question_id)
    supabase.table("answers").insert({
        "answer_id": answer_id,
        "session_id": req.session_id,
        "question_id": qid,
        "board_json": req.board_json,
        "preview_url": preview_url,
        "student_id": req.student_id
    }).execute()

    return {"ok": True, "answer_id": answer_id, "preview_url": preview_url}
