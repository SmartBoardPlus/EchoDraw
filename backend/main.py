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
from pydantic import Field
from supabase import create_client, Client
from collections import defaultdict
from typing import List, Dict, Any

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
    
# ---- TEACHERS: look up by email ----
@app.get("/api/teachers/by_email")
def get_teacher_by_email(email: str):
    """
    Exact match lookup by email (no normalization).
    Usage: /api/teachers/by_email?email=demo@example.com
    """
    r = (
        supabase.table("teachers")
        .select("teacher_id, display_name, email, created_at")
        .eq("email", email)          # ← exact, case-sensitive match
        .limit(1)
        .execute()
    )

    rows = r.data or []
    if not rows:
        return JSONResponse({"ok": False, "error": "Not found"}, status_code=404)

    t = rows[0]
    return {"ok": True, "teacher_id": t["teacher_id"], "teacher": t}


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

# === Update SESSION text (name) ===
class UpdateSessionText(BaseModel):
    name: str = Field(min_length=1, max_length=255)

@app.put("/api/sessions/{session_id}/text")
def update_session_text(session_id: str, req: UpdateSessionText):
    """
    Update the session's display name.
    Body: { "name": "New session name" }
    """
    try:
        res = (
            supabase.table("sessions")
            .update({"name": req.name})
            .eq("session_id", session_id)
            .execute()
        )
        rows = getattr(res, "data", None) or []
        if not rows:
            exists = (
                supabase.table("sessions")
                .select("session_id")
                .eq("session_id", session_id)
                .execute()
            )
            if not getattr(exists, "data", None):
                raise HTTPException(status_code=404, detail="Session not found")
            return {"ok": True, "session_id": session_id, "name": req.name}

        row = rows[0]
        return {"ok": True, "session_id": row["session_id"], "name": row.get("name", req.name)}
    except HTTPException:
        raise
    except Exception as e:
        return JSONResponse({"ok": False, "error": f"{type(e).__name__}: {e}"}, status_code=500)
    
# ---- TEACHER: list past sessions ----
@app.get("/api/teachers/{teacher_id}/sessions")
def list_sessions_for_teacher(teacher_id: str, limit: int = 20, offset: int = 0):
    """
    Returns a teacher's sessions, newest first, with optional current question text.
    Query params:
      - limit (default 20)
      - offset (default 0)
    """
    # basic session fields
    r = supabase.table("sessions").select(
        "session_id, session_name, current_question_id, created_at"
    ).eq("teacher_id", teacher_id).order("created_at", desc=True).range(
        offset, offset + limit - 1
    ).execute()

    rows = r.data or []

    # OPTIONAL: enrich with current question text (one extra query)
    qids = [row["current_question_id"] for row in rows if row.get("current_question_id")]
    if qids:
        qr = supabase.table("questions").select("question_id,question_text").in_("question_id", qids).execute()
        qmap = {q["question_id"]: q["question_text"] for q in (qr.data or [])}
        for row in rows:
            row["current_question_text"] = qmap.get(row.get("current_question_id"))

    return {"ok": True, "sessions": rows}

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

# === Update QUESTION text ===
class UpdateQuestionText(BaseModel):
    question_text: str = Field(min_length=1, max_length=5000)

@app.put("/api/questions/{question_id}/text")
def update_question_text(question_id: str, req: UpdateQuestionText):
    """
    Update the text of a question.
    Body: { "question_text": "New question text..." }
    """
    try:
        res = (
            supabase.table("questions")
            .update({"question_text": req.question_text})
            .eq("question_id", question_id)
            .execute()
        )
        # If your supabase client returns updated rows in res.data:
        rows = getattr(res, "data", None) or []
        if not rows:
            # If no returning rows, verify existence and return minimal payload
            exists = (
                supabase.table("questions")
                .select("question_id")
                .eq("question_id", question_id)
                .execute()
            )
            if not getattr(exists, "data", None):
                raise HTTPException(status_code=404, detail="Question not found")
            return {"ok": True, "question_id": question_id, "question_text": req.question_text}

        row = rows[0]
        return {"ok": True, "question_id": row["question_id"], "question_text": row["question_text"]}
    except HTTPException:
        raise
    except Exception as e:
        return JSONResponse({"ok": False, "error": f"{type(e).__name__}: {e}"}, status_code=500)
    
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

# ---- ALL ANSWERS GROUPED BY QUESTION (for a session) ----
@app.get("/api/sessions/{session_id}/answers_by_question")
def answers_by_question(session_id: str, include_json: bool = True):
    """
    Returns all questions in the session, each with its list of answers.
    Query param:
      - include_json=false|true  (when true, includes board_json per answer; off by default to keep payload light) """
            
    # 1) Get all questions in this session
    q_res = (
        supabase.table("questions")
        .select("question_id,question_text,created_at")
        .eq("session_id", session_id)
        .order("created_at")
        .execute()
    )
    questions: List[Dict[str, Any]] = q_res.data or []
    if not questions:
        return {"ok": True, "questions": []}

    qids = [q["question_id"] for q in questions]

    # 2) Get all answers for those questions (single round-trip)
    fields = "answer_id,question_id,session_id,preview_url,student_id,created_at"
    if include_json:
        fields += ",board_json"

    a_res = (
        supabase.table("answers")
        .select(fields)
        .in_("question_id", qids)
        .order("created_at")
        .execute()
    )
    answers: List[Dict[str, Any]] = a_res.data or []

    # 3) Group answers by question_id
    grouped: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for a in answers:
        grouped[a["question_id"]].append(a)

    # 4) Attach to each question
    out = []
    for q in questions:
        out.append({
            "question_id": q["question_id"],
            "question_text": q["question_text"],
            "created_at": q["created_at"],
            "answers": grouped.get(q["question_id"], []),
        })

    return {"ok": True, "questions": out}

# ------------------------------
# Answers
# ------------------------------
@app.get("/api/questions/{question_id}/answers")
def list_answers_for_question(question_id: str):
    r = supabase.table("answers").select("answer_id,preview_url,created_at").eq("question_id", question_id).order("created_at").execute()
    return r.data or []

# === GET: fetch a question by its ID ===
@app.get("/api/questions/{question_id}")
def get_question_by_id(question_id: str):
    """
    Returns a single question by question_id.
    Response:
      { ok: true, question: { question_id, session_id, question_text, order_index, created_at } }
    404 if not found.
    """
    try:
        res = (
            supabase.table("questions")
            .select("question_id, session_id, question_text, order_index, created_at")
            .eq("question_id", question_id)
            .execute()
        )
        rows = getattr(res, "data", None) or []
        if not rows:
            raise HTTPException(status_code=404, detail="Question not found")
        return {"ok": True, "question": rows[0]}
    except HTTPException:
        raise
    except Exception as e:
        return JSONResponse(
            {"ok": False, "where": "exception", "error": f"{type(e).__name__}: {e}"},
            status_code=500,
        )
    
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
