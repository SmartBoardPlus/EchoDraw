"use client";
import { useState } from "react";

const tinyPNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";

type ApiResult = { res: Response; raw: string; data: any };

export default function Home() {
  const api = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
  console.log("API base =", api);

  // Inputs
  const [teacherId, setTeacherId] = useState<string>("teacher_demo_sub");
  const [sessionName, setSessionName] = useState<string>("Algebra P1");
  const [initialQuestionText, setInitialQuestionText] = useState<string>("What is 2 + 2?");

  // State
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentQuestionId, setCurrentQuestionId] = useState<string | null>(null);
  const [currentQuestionText, setCurrentQuestionText] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");

  async function apiJson(url: string, init?: RequestInit): Promise<ApiResult> {
    const res = await fetch(url, init);
    const raw = await res.text();
    let data: any = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      // keep data = null
    }
    return { res, raw, data };
  }

  // 1) Create Session (and initial current question if text is provided)
  const createSession = async () => {
    setStatus("Creating session...");
    const { res, raw, data } = await apiJson(`${api}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        teacher_id: teacherId,
        session_name: sessionName,
        question_text: initialQuestionText, // creates & sets current question immediately
      }),
    });

    if (!res.ok || !data?.session_id) {
      console.error("createSession error:", raw);
      return setStatus(`Create failed: ${res.status} ${data?.error ?? raw ?? ""}`);
    }

    setSessionId(data.session_id || null);
    setCurrentQuestionId(data.current_question_id || null);

    // If backend didn’t return the text, fetch current question to display it
    if (data.current_question_id) {
      await getCurrentQuestion(data.session_id);
    }

    setStatus(`Session created: ${data.session_id}`);
  };

  // 2) Get current question (student view / before submitting answers)
  const getCurrentQuestion = async (sid?: string | null) => {
    const s = sid ?? sessionId;
    if (!s) return setStatus("No session yet.");
    setStatus("Fetching current question...");

    const { res, raw, data } = await apiJson(`${api}/api/sessions/${s}/current_question`);
    if (!res.ok) {
      console.error("getCurrentQuestion error:", raw);
      return setStatus(`Fetch failed: ${res.status} ${data?.error ?? raw ?? ""}`);
    }

    const q = data?.question ?? null;
    setCurrentQuestionId(q?.question_id ?? null);
    setCurrentQuestionText(q?.question_text ?? null);

    setStatus(q ? `Current: ${q.question_text}` : "No current question set.");
  };

  // 3) Create a new question and set it as current (teacher flow)
  const createAndSetQuestion = async () => {
    if (!sessionId) return setStatus("No session yet.");
    if (!initialQuestionText.trim()) return setStatus("Enter a question first.");

    setStatus("Creating question...");
    const qCreate = await apiJson(`${api}/api/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        question_text: initialQuestionText,
      }),
    });

    if (!qCreate.res.ok || !qCreate.data?.question_id) {
      console.error("createQuestion error:", qCreate.raw);
      return setStatus(`Create question failed: ${qCreate.res.status} ${qCreate.data?.error ?? qCreate.raw ?? ""}`);
    }

    const qid = qCreate.data.question_id as string;

    setStatus("Setting current question...");
    const setCur = await apiJson(`${api}/api/sessions/${sessionId}/current_question`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question_id: qid }),
    });

    if (!setCur.res.ok) {
      console.error("setCurrentQuestion error:", setCur.raw);
      return setStatus(`Set current failed: ${setCur.res.status} ${setCur.data?.error ?? setCur.raw ?? ""}`);
    }

    setCurrentQuestionId(qid);
    setCurrentQuestionText(initialQuestionText);
    setStatus(`New current question set. (qid=${qid})`);
  };

  // 4) Submit an answer (uses current question; includes question_id if we have it)
  const submitAnswer = async () => {
    if (!sessionId) return setStatus("No session yet.");

    // ensure we have the latest current question
    if (!currentQuestionId) {
      await getCurrentQuestion(sessionId);
      if (!currentQuestionId) {
        return setStatus("No current question available.");
      }
    }

    setStatus("Submitting answer...");
    const { res, raw, data } = await apiJson(`${api}/api/answers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        question_id: currentQuestionId, // recommended to include
        board_json: { objects: [], version: "5.2.4" },
        // preview_png_base64: tinyPNG, // uncomment to store a preview
      }),
    });

    if (!res.ok) {
      console.error("submitAnswer error:", raw);
      return setStatus(`Submit failed: ${res.status} ${data?.error ?? raw ?? ""}`);
    }
    if (!data?.answer_id) {
      return setStatus(`Submit ok but malformed response: ${raw || "(no body)"}`);
    }
    setStatus(`Answer submitted. answer_id=${data.answer_id}`);
  };

  // 5) List previews (for current question)
  const listPreviews = async () => {
    if (!sessionId) return setStatus("No session yet.");
    if (!currentQuestionId) {
      await getCurrentQuestion(sessionId);
      if (!currentQuestionId) return setStatus("No current question yet.");
    }

    const { res, raw, data } = await apiJson(`${api}/api/questions/${currentQuestionId}/answers`);
    if (!res.ok) {
      console.error("listPreviews error:", raw);
      return setStatus(`List failed: ${res.status} ${data?.error ?? raw ?? ""}`);
    }
    console.log("Previews:", data);
    setStatus(`Previews loaded for qid=${currentQuestionId} (see console).`);
  };

  // 6) Shuffle (for current question)
  const shuffle = async () => {
    if (!sessionId) return setStatus("No session yet.");
    if (!currentQuestionId) {
      await getCurrentQuestion(sessionId);
      if (!currentQuestionId) return setStatus("No current question yet.");
    }

    const { res, raw, data } = await apiJson(`${api}/api/questions/${currentQuestionId}/answers/shuffled`);
    if (!res.ok) {
      console.error("shuffle error:", raw);
      return setStatus(`Shuffle failed: ${res.status} ${data?.error ?? raw ?? ""}`);
    }
    console.log("Order:", data?.order ?? []);
    setStatus(`Shuffled order for qid=${currentQuestionId} (see console).`);
  };

  return (
    <main style={{ padding: 24 }}>
      <h1>AnswerBoard quick test</h1>

      <div style={{ margin: "12px 0", display: "grid", gap: 8, maxWidth: 640 }}>
        <input
          value={teacherId}
          onChange={(e) => setTeacherId(e.target.value)}
          placeholder="teacher_id"
          style={{ border: "1px solid #ccc", padding: "6px 8px" }}
        />
        <input
          value={sessionName}
          onChange={(e) => setSessionName(e.target.value)}
          placeholder="session_name"
          style={{ border: "1px solid #ccc", padding: "6px 8px" }}
        />
        <input
          value={initialQuestionText}
          onChange={(e) => setInitialQuestionText(e.target.value)}
          placeholder="question_text (used for initial or new question)"
          style={{ border: "1px solid #ccc", padding: "6px 8px" }}
        />
      </div>

      <p>Status: {status}</p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={createSession}>Create Session</button>
        <button onClick={() => getCurrentQuestion(null)}>Get Current Question</button>
        <button onClick={createAndSetQuestion}>Create & Set New Question</button>
        <button onClick={submitAnswer}>Submit Test Answer</button>
        <button onClick={listPreviews}>List Previews</button>
        <button onClick={shuffle}>Shuffle</button>
      </div>

      <div style={{ marginTop: 12, lineHeight: 1.6 }}>
        <div>Session ID: {sessionId ?? "(none)"}</div>
        <div>
          Current Question:{" "}
          {currentQuestionId ? `${currentQuestionText ?? "(no text)"} [${currentQuestionId}]` : "(none)"}
        </div>
      </div>
    </main>
  );
}
