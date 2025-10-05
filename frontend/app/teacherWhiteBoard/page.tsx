"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NextPage } from "next";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";

// Excalidraw CSS
import "@excalidraw/excalidraw/index.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

/* ───────────────── Palette (optional) ───────────────── */
const PALETTE_MD = `{
"palette-1": "#F7F7F7",
"palette-2": "#B7DFF1",
"palette-3": "#73C5D4",
"palette-4": "#34A8A2",
"palette-5": "#007B80"
}`;

function parsePalette(md: string) {
  try {
    const obj = JSON.parse(md);
    const p1 = obj["palette-1"], p2 = obj["palette-2"], p3 = obj["palette-3"], p4 = obj["palette-4"], p5 = obj["palette-5"];
    if ([p1, p2, p3, p4, p5].every(Boolean)) return { p1, p2, p3, p4, p5 };
  } catch {}
  return { p1: "#ffffff", p2: "#e5e5e5", p3: "#cccccc", p4: "#888888", p5: "#111111" };
}

function paletteToCSSVars(p: { p1?: string; p2?: string; p3?: string; p4?: string; p5?: string }) {
  const { p1 = "#ffffff", p2 = "#e5e5e5", p3 = "#cccccc", p4 = "#888888", p5 = "#111111" } = p || {};
  return `
    :root{
      --bg: ${p5};
      --text: ${p1};
      --primary: ${p4};
      --muted: ${p3};
      --border: ${p3};
      --surface: ${p2};
    }
  `;
}

/* ───────── Excalidraw dynamic import (TS-friendly) ───────── */
const ExcalidrawDynamic = dynamic<any>(
  async () => {
    const m: any = await import("@excalidraw/excalidraw");
    return (m.Excalidraw ?? m.default) as any;
  },
  { ssr: false, loading: () => <div style={{ padding: 24 }}>Loading whiteboard…</div> }
);
const Excal: React.ComponentType<any> = ExcalidrawDynamic as unknown as React.ComponentType<any>;

/* ───────────────────────── Page ───────────────────────── */
const Page: NextPage = () => {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Accept both snake_case and PascalCase keys from URL
  const sessionId = useMemo(
    () => searchParams.get("session_id") || searchParams.get("session") || "",
    [searchParams]
  );
  const questionId = useMemo(
    () => searchParams.get("question_id") || searchParams.get("QuestionId") || "",
    [searchParams]
  );

  // Editors
  const [sessionName, setSessionName] = useState<string>("");
  const [questionText, setQuestionText] = useState<string>("");

  const [msg, setMsg] = useState<string>("");
  const [loadingSession, setLoadingSession] = useState<boolean>(false);
  const [loadingQuestion, setLoadingQuestion] = useState<boolean>(false);

  // Excalidraw scene state
  const [elements, setElements] = useState<any[]>([]);
  const [appState, setAppState] = useState<any>({});
  const [files, setFiles] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const sceneRef = useRef<{ elements: any[]; appState: any; files: Record<string, any> } | null>(null);

  // Robust onChange (works with 2 or 3 args)
  const handleChange = useCallback((...args: any[]) => {
    const els = Array.isArray(args[0]) ? args[0] : [];
    const state = args[1] && typeof args[1] === "object" ? args[1] : {};
    const fls = args[2] && typeof args[2] === "object" ? args[2] : {};
    setElements(els);
    setAppState(state);
    setFiles(fls);
    sceneRef.current = { elements: els, appState: state, files: fls };
  }, []);

  const cssVars = useMemo(() => paletteToCSSVars(parsePalette(PALETTE_MD)), []);

  /* ───── Optional: prefill current values ───── */
  useEffect(() => {
    const loadSession = async () => {
      if (!sessionId) return;
      try {
        setLoadingSession(true);
        const r = await fetch(`${API_BASE}/api/sessions/${encodeURIComponent(sessionId)}`);
        if (r.ok) {
          const data = await r.json();
          // Prefer 'name' if available; otherwise keep blank
          const name = data?.session?.name ?? data?.name ?? "";
          if (name) setSessionName(name);
        }
      } finally {
        setLoadingSession(false);
      }
    };
    const loadQuestion = async () => {
      if (!questionId) return;
      try {
        setLoadingQuestion(true);
        // Only call if you have GET /api/questions/{question_id}. If not, skip.
        const r = await fetch(`${API_BASE}/api/questions/${encodeURIComponent(questionId)}`);
        if (r.ok) {
          const data = await r.json();
          const text = data?.question_text ?? data?.question?.question_text ?? "";
          if (text) setQuestionText(text);
        }
      } finally {
        setLoadingQuestion(false);
      }
    };
    loadSession();
    loadQuestion();
  }, [sessionId, questionId]);

  /* ───── Save session name (PUT) ───── */
  const saveSessionName = async () => {
    if (!sessionId || !sessionName.trim()) {
      setMsg("Provide a valid session id and name.");
      return;
    }
    setMsg("Saving session name…");
    try {
      const res = await fetch(`${API_BASE}/api/sessions/${encodeURIComponent(sessionId)}/text`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: sessionName.trim() }),
      });
      const raw = await res.text();
      const data = raw ? JSON.parse(raw) : {};
      if (!res.ok) throw new Error(`${res.status} ${data?.detail ?? data?.error ?? raw}`);
      setMsg(`✅ Session name updated to: “${data?.name ?? sessionName}”`);
    } catch (e: any) {
      setMsg(`❌ ${e.message || e}`);
    }
  };

  /* ───── Save question text (PUT) ───── */
  const saveQuestionText = async () => {
    if (!questionId || !questionText.trim()) {
      setMsg("Provide a valid question id and text.");
      return;
    }
    setMsg("Saving question text…");
    try {
      const res = await fetch(`${API_BASE}/api/questions/${encodeURIComponent(questionId)}/text`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question_text: questionText.trim() }),
      });
      const raw = await res.text();
      const data = raw ? JSON.parse(raw) : {};
      if (!res.ok) throw new Error(`${res.status} ${data?.detail ?? data?.error ?? raw}`);
      setMsg(`✅ Question updated: “${data?.question_text ?? questionText}”`);
    } catch (e: any) {
      setMsg(`❌ ${e.message || e}`);
    }
  };

  /* ───── Your existing Save button for the canvas ───── */
  const doSubmit = useCallback(() => {
    if (submitted) return;
    const snapshot = sceneRef.current ?? { elements, appState, files };
    const payload = {
      elements: snapshot.elements ?? [],
      appState: snapshot.appState ?? {},
      files: snapshot.files ?? {},
      submittedAt: new Date().toISOString(),
    };
    try {
      console.log("TEACHER_CANVAS_SNAPSHOT:", payload);
      setSubmitted(true);
      setShowToast(true);
    } catch (err) {
      console.error("Failed to save question canvas:", err);
    } finally {
      router.push("/questions");
    }
  }, [elements, appState, files, submitted, router]);

  return (
    <div className="page-root" style={{ minHeight: "100vh" }}>
      <style jsx global>{`
        ${cssVars}
        html, body, #__next { height: 100%; background: var(--bg); color: var(--text); }
        * { box-sizing: border-box; }

        .page-root { display: flex; flex-direction: column; gap: 16px; padding: 16px; }
        .card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; box-shadow: 0 1px 0 rgba(0,0,0,0.025); }
        .excalidraw-wrap { height: 72vh; border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
        .row { display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: end; }
        .label { font-size: 0.9rem; margin-bottom: 4px; display: block; }
        .input, .textarea { width: 100%; border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; background: #fff; color: #000; }
        .textarea { min-height: 84px; }
        .btn { border: 1px solid var(--border); border-radius: 10px; padding: 10px 16px; background: var(--primary); color: var(--text); font-weight: 600; cursor: pointer; transition: transform .02s ease, filter .15s ease; user-select: none; }
        .btn:hover { filter: brightness(0.95); }
        .btn:active { transform: translateY(1px); }
        .submit-bar { display: flex; justify-content: flex-end; gap: 8px; padding: 8px; }
        .msg { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 8px 12px; }
        .note { font-size: 0.85rem; opacity: 0.8; }
      `}</style>

      {/* Status */}
      {msg && <div className="msg">{msg}</div>}

      {/* Editors */}
      <div className="card" style={{ padding: 16, display: "grid", gap: 16 }}>
        <div className="row">
          <div>
            <label className="label">Session ID</label>
            <input
              className="input"
              placeholder="session_id (uuid or short code)"
              value={sessionId}
              readOnly
            />
          </div>
          <button className="btn" onClick={saveSessionName} disabled={!sessionId || loadingSession}>
            {loadingSession ? "Saving…" : "Save Session Name"}
          </button>
        </div>
        <div>
          <label className="label">Session Name</label>
          <input
            className="input"
            placeholder="e.g., Algebra – Period 2"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
          />
          <div className="note">Updates: <code>PUT /api/sessions/{`{session_id}`}/text</code></div>
        </div>

        <hr style={{ borderColor: "var(--border)" }} />

        <div className="row">
          <div>
            <label className="label">Question ID</label>
            <input
              className="input"
              placeholder="question_id (uuid)"
              value={questionId}
              readOnly
            />
          </div>
          <button className="btn" onClick={saveQuestionText} disabled={!questionId || loadingQuestion}>
            {loadingQuestion ? "Saving…" : "Save Question Text"}
          </button>
        </div>
        <div>
          <label className="label">Question Text</label>
          <textarea
            className="textarea"
            placeholder="Type the new question here…"
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
          />
          <div className="note">Updates: <code>PUT /api/questions/{`{question_id}`}/text</code></div>
        </div>
      </div>

      {/* Canvas */}
      <div className="card excalidraw-wrap" aria-label="Whiteboard">
        <Excal
          onChange={handleChange as any}
          viewModeEnabled={submitted}
          gridModeEnabled={false}
          initialData={{ elements: [], appState: {}, files: {} }}
        />
      </div>

      {/* Save canvas + navigate */}
      <div className="submit-bar">
        <button className="btn" onClick={doSubmit} disabled={submitted} aria-disabled={submitted ? "true" : "false"}>
          {submitted ? "Question Saved" : "Save"}
        </button>
      </div>

      {/* Toast */}
      {showToast && (
        <div className="msg">Question Saved</div>
      )}
    </div>
  );
};

export default Page;
