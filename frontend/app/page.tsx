"use client";
import { useState } from "react";

const tinyPNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";

export default function Home() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");

  const api = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
  console.log("API base =", api);

  const createSession = async () => {
    setStatus("Creating session...");
    const res = await fetch(`${api}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        teacher_id: "teacher_demo_sub",
        question_text: "Sketch y = 2x + 1",
      }),
    });
    const data = await res.json();
    setSessionId(data.session_id);
    setStatus("Session created.");
  };

  const submitAnswer = async () => {
  if (!sessionId) return setStatus("No session yet.");
  setStatus("Submitting answer...");

  try {
    const res = await fetch(`${api}/api/answers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        board_json: { objects: [], version: "5.2.4" },
        // preview_png_base64: tinyPNG,   // add back later after backend works
      }),
    });

    const raw = await res.text();
    console.log("answers raw:", raw, "status:", res.status);

    let data: any = null;
    try { data = raw ? JSON.parse(raw) : null; } catch {}

    if (!res.ok) {
      return setStatus(`Submit failed: ${res.status} ${data?.detail ?? raw ?? ""}`);
    }
    if (!data?.answer_id) {
      return setStatus(`Submit ok but malformed response: ${raw || "(no body)"}`);
    }

    setStatus(`Answer submitted. answer_id=${data.answer_id}`);
  } catch (e: any) {
    setStatus(`Network error: ${e?.message || e}`);
  }
};


  const listPreviews = async () => {
    if (!sessionId) return setStatus("No session yet.");
    const res = await fetch(`${api}/api/sessions/${sessionId}/answers?preview=true`);
    const data = await res.json();
    console.log("Previews:", data);
    setStatus("Previews loaded (see console).");
  };

  const shuffle = async () => {
    if (!sessionId) return setStatus("No session yet.");
    const res = await fetch(`${api}/api/sessions/${sessionId}/shuffled`);
    const data = await res.json();
    console.log("Order:", data.order);
    setStatus("Shuffled (see console).");
  };

  return (
    <main style={{ padding: 24 }}>
      <h1>AnswerBoard quick test</h1>
      <p>Status: {status}</p>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={createSession}>Create Session</button>
        <button onClick={submitAnswer}>Submit Test Answer</button>
        <button onClick={listPreviews}>List Previews</button>
        <button onClick={shuffle}>Shuffle</button>
      </div>
      <p style={{ marginTop: 12 }}>Session ID: {sessionId}</p>
    </main>
  );
}
