# backend/main.py
import os
import uuid
import base64
from pathlib import Path
from typing import Optional, Any, List, Dict
from collections import defaultdict

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
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
    # optional: create an initial question
    question_text: Optional[str] = None

class CreateQuestionReq(BaseModel):
    session_id: str
    # allow either classic string or full JSON body from the frontend
    question_text: Optional[str] = None
    question_body: Optional[dict] = None

class SetCurrentQuestionReq(BaseModel):
    question_id: str

class SubmitAnswerReq(BaseModel):
    session_id: str
    board_json: dict
    question_id: Optional[str] = None
    preview_png_base64: Optional[str] = None
    student_id: Optional[str] = None

# === PUT payloads ===
class UpdateSessionName(BaseModel):      # CHANGED (was UpdateSessionText/name)
    session_name: str = Field(min_length=1, max_length=255)

class UpdateQuestionText(BaseModel):
    # keep simple text update; we'll write both questi  on_body and question_text
    question_text: str = Field(min_length=1, max_length=5000)
    question_body: Optional[dict] = None

# ------------------------------
# Helpers
# ------------------------------
def _qstring(row: Dict[str, Any]) -> Optional[str]:
    """
    Normalize to a single display string for a question:
    prefer question_body['text'] if present; fallback to legacy question_text.
    """
    qb = row.get("question_body")
    if isinstance(qb, dict) and "text" in qb:
        return qb.get("text")
    # Supabase may deserialize jsonb to dict; if you see string, adjust as needed.
    return row.get("question_text")

def _get_session(session_id: str) -> Optional[Dict[str, Any]]:
    r = (
        supabase.table("sessions")
        .select("session_id,current_question_id")
        .eq("session_id", session_id)
        .execute()
    )
    data = r.data or []
    return data[0] if data else None

def _get_question(question_id: str) -> Optional[Dict[str, Any]]:
    r = (
        supabase.table("questions")
        .select("question_id,session_id,question_body,question_text")
        .eq("question_id", question_id)
        .execute()
    )
    data = r.data or []
    return data[0] if data else None

# ------------------------------
# Teachers
# ------------------------------
@app.post("/api/teachers")
def create_teacher(req: CreateTeacherReq):
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

@app.get("/api/teachers/by_email")
def get_teacher_by_email(email: str):
    r = (
        supabase.table("teachers")
        .select("teacher_id, display_name, email, created_at")
        .eq("email", email)
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
    If question_text is provided, we also create an initial question and set it current.
    """
    session_id = str(uuid.uuid4())

    try:
        # 1) Insert session
        ins = (
            supabase.table("sessions")
            .insert({
                "session_id": session_id,
                "teacher_id": req.teacher_id,
                "session_name": req.session_name
            })
            .execute()
        )
        if getattr(ins, "error", None):
            return JSONResponse({"ok": False, "where": "insert_session", "error": str(ins.error)}, status_code=500)

        current_question_id = None

        # 2) If initial question requested
        if req.question_text:
            qid = str(uuid.uuid4())
            q_payload = {
                "question_id": qid,
                "session_id": session_id,
                "question_text": req.question_text,           # legacy column
                "question_body": {"text": req.question_text}  # NEW jsonb column
            }
            qins = supabase.table("questions").insert(q_payload).execute()
            if getattr(qins, "error", None):
                return JSONResponse({"ok": False, "where": "insert_question", "error": str(qins.error)}, status_code=500)

            supabase.table("sessions").update({"current_question_id": qid}).eq("session_id", session_id).execute()
            current_question_id = qid

        return {"ok": True, "session_id": session_id, "current_question_id": current_question_id}
    except Exception as e:
        return JSONResponse({"ok": False, "where": "exception", "error": f"{type(e).__name__}: {e}"}, status_code=500)

# === Update SESSION NAME (not 'name') ===   # CHANGED
@app.put("/api/sessions/{session_id}/name")
def update_session_name(session_id: str, req: UpdateSessionName):
    """
    Update the session's display name.
    Body: { "session_name": "New session name" }
    """
    try:
        res = (
            supabase.table("sessions")
            .update({"session_name": req.session_name})
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
            return {"ok": True, "session_id": session_id, "session_name": req.session_name}

        row = rows[0]
        return {"ok": True, "session_id": row["session_id"], "session_name": row.get("session_name", req.session_name)}
    except HTTPException:
        raise
    except Exception as e:
        return JSONResponse({"ok": False, "error": f"{type(e).__name__}: {e}"}, status_code=500)

@app.get("/api/teachers/{teacher_id}/sessions")
def list_sessions_for_teacher(teacher_id: str, limit: int = 20, offset: int = 0):
    r = (
        supabase.table("sessions")
        .select("session_id, session_name, current_question_id, created_at")
        .eq("teacher_id", teacher_id)
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    rows = r.data or []
    # enrich with current question text (optional)
    qids = [row["current_question_id"] for row in rows if row.get("current_question_id")]
    if qids:
        qr = (
            supabase.table("questions")
            .select("question_id,question_body,question_text")
            .in_("question_id", qids)
            .execute()
        )
        qmap = {q["question_id"]: _qstring(q) for q in (qr.data or [])}
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
    text = req.question_text or (req.question_body.get("text") if isinstance(req.question_body, dict) else None)
    if not text:
        return JSONResponse({"ok": False, "error": "question_text or question_body.text is required"}, status_code=400)

    try:
        qins = (
            supabase.table("questions")
            .insert({
                "question_id": question_id,
                "session_id": req.session_id,
                "question_text": text,               # legacy string
                "question_body": req.question_body or {"text": text},  # jsonb
            })
            .execute()
        )
        if getattr(qins, "error", None):
            return JSONResponse({"ok": False, "where": "insert_question", "error": str(qins.error)}, status_code=500)
        return {"ok": True, "question_id": question_id}
    except Exception as e:
        return JSONResponse({"ok": False, "where": "exception", "error": f"{type(e).__name__}: {e}"}, status_code=500)

# === Update QUESTION text (writes both columns) ===
@app.put("/api/questions/{question_id}/text")
def update_question_text(question_id: str, req: UpdateQuestionText):
    try:
        payload = {
            "question_text": req.question_text,             # legacy col
            "question_body": req.question_body,   # jsonb col
        }
        res = (
            supabase.table("questions")
            .update(payload)
            .eq("question_id", question_id)
            .execute()
        )
        rows = getattr(res, "data", None) or []
        if not rows:
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
        return {"ok": True, "question_id": row["question_id"], "question_text": _qstring(row)}
    except HTTPException:
        raise
    except Exception as e:
        return JSONResponse({"ok": False, "error": f"{type(e).__name__}: {e}"}, status_code=500)

@app.post("/api/sessions/{session_id}/current_question")
def set_current_question(session_id: str, req: SetCurrentQuestionReq):
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
        return {"ok": True, "question": None}

    q = (
        supabase.table("questions")
        .select("question_id,question_body,question_text,created_at")
        .eq("question_id", cqid)
        .execute()
    )
    qd = q.data or []
    if not qd:
        return {"ok": True, "question": None}
    row = qd[0]
    return {"ok": True, "question": {
        "question_id": row["question_id"],
        "question_text": _qstring(row),
        "created_at": row["created_at"],
    }}

@app.get("/api/sessions/{session_id}/questions")
def list_questions(session_id: str):
    r = (
        supabase.table("questions")
        .select("question_id,question_body,question_text,created_at")
        .eq("session_id", session_id)
        .order("created_at")
        .execute()
    )
    rows = r.data or []
    return [
        {"question_id": x["question_id"], "question_text": _qstring(x), "created_at": x["created_at"], "question_body": x["question_body"]}
        for x in rows
    ]

# ---- ALL ANSWERS GROUPED BY QUESTION (for a session) ----
@app.get("/api/sessions/{session_id}/answers_by_question")
def answers_by_question(session_id: str, include_json: bool = True):
    q_res = (
        supabase.table("questions")
        .select("question_id,question_body,question_text,created_at")
        .eq("session_id", session_id)
        .order("created_at")
        .execute()
    )
    questions: List[Dict[str, Any]] = q_res.data or []
    if not questions:
        return {"ok": True, "questions": []}
    qids = [q["question_id"] for q in questions]

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
    grouped: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for a in answers:
        grouped[a["question_id"]].append(a)

    out = []
    for q in questions:
        out.append({
            "question_id": q["question_id"],
            "question_text": _qstring(q),
            "created_at": q["created_at"],
            "answers": grouped.get(q["question_id"], []),
        })
    return {"ok": True, "questions": out}

# ------------------------------
# Answers
# ------------------------------
@app.get("/api/questions/{question_id}/answers")
def list_answers_for_question(question_id: str):
    r = (
        supabase.table("answers")
        .select("answer_id,preview_url,created_at")
        .eq("question_id", question_id)
        .order("created_at")
        .execute()
    )
    return r.data or []

@app.get("/api/questions/{question_id}")
def get_question_by_id(question_id: str):
    try:
        res = (
            supabase.table("questions")
            .select("question_id, session_id, question_body, question_text, order_index, created_at")
            .eq("question_id", question_id)
            .execute()
        )
        rows = getattr(res, "data", None) or []
        if not rows:
            raise HTTPException(status_code=404, detail="Question not found")
        row = rows[0]
        return {"ok": True, "question": {
            "question_id": row["question_id"],
            "session_id": row["session_id"],
            "order_index": row.get("order_index"),
            "created_at": row["created_at"],
            "question_text": _qstring(row),
            "question_body": row.get("question_body"),
        }}
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
    ses = _get_session(req.session_id)
    if not ses:
        return JSONResponse({"ok": False, "error": "Invalid session_id"}, status_code=400)

    qid = req.question_id or ses.get("current_question_id")
    if not qid:
        return JSONResponse({"ok": False, "error": "No current question for this session"}, status_code=400)

    q = _get_question(qid)
    if not q or q["session_id"] != req.session_id:
        return JSONResponse({"ok": False, "error": "question_id does not belong to session"}, status_code=400)

    answer_id = str(uuid.uuid4())
    preview_url = None

    if req.preview_png_base64:
        try:
            raw = base64.b64decode(req.preview_png_base64)
            path = f"{req.session_id}/{answer_id}.png"
            supabase.storage.from_(BUCKET).upload(path, raw, {"content-type": "image/png", "upsert": True})
            preview_url = supabase.storage.from_(BUCKET).get_public_url(path)
        except Exception as e:
            print("STORAGE UPLOAD ERROR:", e)

    supabase.table("answers").insert({
        "answer_id": answer_id,
        "session_id": req.session_id,
        "question_id": qid,
        "board_json": req.board_json,
        "preview_url": preview_url,
        "student_id": req.student_id
    }).execute()

    return {"ok": True, "answer_id": answer_id, "preview_url": preview_url}
