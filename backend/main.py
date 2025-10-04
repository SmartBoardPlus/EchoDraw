from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from supabase import create_client, Client
import os, base64, uuid, random

# load .env
load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
BUCKET = os.environ.get("SUPABASE_BUCKET", "answer_previews")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

app = FastAPI(title="AnswerBoard API")

# dev CORS: allow Next.js localhost
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- Models ----------
class CreateSessionReq(BaseModel):
    teacher_id: str  # for now we pass this directly; later replace with Auth0-sub
    question_text: str

class SubmitAnswerReq(BaseModel):
    session_id: str
    board_json: dict
    preview_png_base64: str | None = None
    student_id: str | None = None

# ---------- Health ----------
@app.get("/api/health")
def health():
    return {"ok": True}

# ---------- Sessions ----------
@app.post("/api/sessions")
def create_session(req: CreateSessionReq):
    res = supabase.table("sessions").insert({
        "teacher_id": req.teacher_id,
        "question_text": req.question_text
    }).execute()
    if not res.data:
        raise HTTPException(500, "Insert failed")
    return res.data[0]

@app.get("/api/sessions/{session_id}")
def get_session(session_id: str):
    res = supabase.table("sessions").select("*").eq("session_id", session_id).single().execute()
    if not res.data:
        raise HTTPException(404, "Not found")
    return res.data

@app.get("/api/sessions/{session_id}/answers")
def list_answers(session_id: str, preview: bool = True):
    res = supabase.table("answers").select("*").eq("session_id", session_id).order("created_at", desc=True).execute()
    rows = res.data or []
    if preview:
        return [{"answer_id": r["answer_id"], "preview_url": r["preview_url"]} for r in rows]
    return [{"answer_id": r["answer_id"], "board_json": r["board_json"], "preview_url": r["preview_url"]} for r in rows]

@app.get("/api/sessions/{session_id}/shuffled")
def shuffled(session_id: str):
    res = supabase.table("answers").select("answer_id").eq("session_id", session_id).execute()
    ids = [r["answer_id"] for r in (res.data or [])]
    random.shuffle(ids)
    return {"order": ids}

# ---------- Answers ----------
@app.get("/api/answers/{answer_id}")
def get_answer(answer_id: str):
    res = supabase.table("answers").select("*").eq("answer_id", answer_id).single().execute()
    if not res.data:
        raise HTTPException(404, "Not found")
    return {"board_json": res.data["board_json"], "preview_url": res.data["preview_url"]}

@app.post("/api/answers")
def submit_answer(req: SubmitAnswerReq):
    # make id now so we can name the file path
    answer_id = str(uuid.uuid4())
    # insert first
    ins = supabase.table("answers").insert({
        "answer_id": answer_id,
        "session_id": req.session_id,
        "board_json": req.board_json,
        "student_id": req.student_id
    }).execute()
    if not ins.data:
        raise HTTPException(500, "Answer insert failed")

    preview_url = None
    if req.preview_png_base64:
        raw = base64.b64decode(req.preview_png_base64)
        path = f"{req.session_id}/{answer_id}.png"
        supabase.storage.from_(BUCKET).upload(path, raw, {"content-type": "image/png", "upsert": "true"})
        preview_url = supabase.storage.from_(BUCKET).get_public_url(path)
        supabase.table("answers").update({"preview_url": preview_url}).eq("answer_id", answer_id).execute()

    return {"answer_id": answer_id, "preview_url": preview_url}
