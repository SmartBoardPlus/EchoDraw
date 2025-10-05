"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NextPage } from "next";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";

// ✅ Excalidraw CSS
import "@excalidraw/excalidraw/index.css";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

/* ------------------------------------------------------------------ */
/*  Palette (example)                                                  */
/* ------------------------------------------------------------------ */
const PALETTE_MD = `{
  "palette-1": "#F7F7F7",
  "palette-2": "#B7DFF1",
  "palette-3": "#73C5D4",
  "palette-4": "#34A8A2",
  "palette-5": "#007B80"
}`;

type Question = {
  question_body: { elements: any[]; appState: any; files: Record<string, any> } | null;
  question_id: string;
  question_text: string;
  created_at: string;
};

function parsePalette(md: string) {
  const hexes = Array.from(md.matchAll(/#[0-9a-fA-F]{6}\b/g)).map((m) => m[0]);
  const [p1, p2, p3, p4, p5] = hexes.slice(0, 5);
  return { p1, p2, p3, p4, p5 };
}

function paletteToCSSVars(p: any) {
  const { p1 = "#ffffff", p2 = "#e5e5e5", p3 = "#cccccc", p4 = "#888888", p5 = "#111111" } = p;
  return `
    :root { --bg: ${p5}; --text: ${p1}; --primary: ${p4}; --muted: ${p3}; --border: ${p3}; --surface: ${p2}; }
    html, body, #__next { height:100%; background: var(--bg); color: var(--text); }
    *{ box-sizing: border-box; }
    .page-root{ min-height:100vh; display:flex; flex-direction:column; gap:16px; padding:16px; }
    .excalidraw-wrap { height: calc(100vh - 160px); position: relative; border: 1px solid var(--border); border-radius: 12px; overflow: hidden; background: var(--surface); }
    .submit-bar { position: fixed; bottom: 24px; right: 20px; z-index: 30; }
    .btn { background: var(--primary); color: var(--text); border: 1px solid var(--border); border-radius: 10px; padding: 10px 16px; cursor: pointer; font-weight:600; }
    .btn:hover{ filter: brightness(0.95); }
    .btn:active{ transform: translateY(1px); }
    .btn[disabled], .btn[aria-disabled="true"]{ filter: brightness(85%); cursor: not-allowed; }
    .timer-badge { position: fixed; top: 16px; right: 16px; z-index: 40; min-width: 96px; padding: 6px 12px; border-radius: 999px; background: var(--primary); color: var(--text); border:1px solid var(--border); font-weight:700; text-align:center; box-shadow: 0 2px 10px rgba(0,0,0,.08); }
    .timer-danger { background: #cc3b3b; color: #fff; }
    .toast { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); background: var(--surface); color: var(--text); border: 1px solid var(--border); border-radius: 12px; padding: 10px 14px; box-shadow: 0 6px 24px rgba(0,0,0,0.12); display:flex; gap:10px; align-items:center; z-index: 50; }
    .toast button { border: 1px solid var(--border); background: var(--bg); color: var(--text); border-radius: 8px; padding: 6px 8px; cursor: pointer; }
  `;
}

const ExcalidrawDynamic = dynamic(async () => (await import("@excalidraw/excalidraw")).Excalidraw, {
  ssr: false,
  loading: () => <div>Loading whiteboard…</div>,
});

const Excal = ExcalidrawDynamic as unknown as React.ComponentType<any>;

// ✅ Sanitize appState to prevent collaborators crash
const toScene = (qb: Question["question_body"] | null | undefined) => {
  const elements = qb?.elements ?? [];
  const files = qb?.files ?? {};
  const rawApp = (qb?.appState ?? {}) as any;
  const app = { ...rawApp };
  if ("collaborators" in app) {
    const c = app.collaborators as any;
    if (!c || typeof c.forEach !== "function") delete app.collaborators;
  }
  return { elements, appState: app, files };
};

const Page: NextPage = () => {
  const searchParams = useSearchParams();
  const session_Id = useMemo(() => searchParams.get("SessionId") || "-1", [searchParams]);

  // Timer controls (default 120s; ?t=SECONDS; ?timed=false disables)
  const timed = useMemo(() => searchParams.get("timed") !== "false", [searchParams]);
  const totalSeconds = useMemo(() => {
    const tParam = searchParams.get("t");
    const parsed = tParam ? parseInt(tParam, 10) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 24 * 60 * 60) : 120;
  }, [searchParams]);

  const [remaining, setRemaining] = useState<number>(totalSeconds);
  const [submitted, setSubmitted] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [qIndex, setQIndex] = useState(0);

  const excalAPIRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const sceneRef = useRef<{ elements: any[]; appState: any; files: Record<string, any> } | null>(null);

  // Fetch questions and load first scene
  useEffect(() => {
    fetch(`http://localhost:8000/api/sessions/${session_Id}/questions`)
      .then((r) => r.json())
      .then((data: Question[]) => {
        setQuestions(data || []);
        const firstScene = toScene(data?.[0]?.question_body);
        sceneRef.current = firstScene;
        excalAPIRef.current?.updateScene(firstScene);
        setQIndex(0);
      })
      .catch((e) => console.error("Failed to load questions:", e));
  }, [session_Id]);

  // Update scene on question change
  useEffect(() => {
    if (!excalAPIRef.current) return;
    const scene = toScene(questions[qIndex]?.question_body);
    sceneRef.current = scene;
    excalAPIRef.current.updateScene(scene);
  }, [qIndex, questions]);

  // Handle onChange
  const handleChange = useCallback((els: any[], state: any, f: Record<string, any>) => {
    sceneRef.current = { elements: els, appState: state, files: f };
  }, []);

  // Submit
  const doSubmit = useCallback(() => {
    if (submitted) return;
    const snapshot = sceneRef.current ?? { elements: [], appState: {}, files: {} };
    const cleanApp = (() => {
      const a = snapshot.appState ? { ...(snapshot.appState as any) } : {};
      if ("collaborators" in a) delete (a as any).collaborators;
      return a;
    })();
    const payload = { elements: snapshot.elements ?? [], appState: cleanApp, files: snapshot.files ?? {}, submittedAt: new Date().toISOString() };

    fetch("http://localhost:8000/api/answers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ board_json: payload, session_id: session_Id, question_id: questions[qIndex]?.question_id }),
    }).catch((e) => console.error("submit failed:", e));

    setSubmitted(true);
    setShowToast(true);
  }, [submitted, session_Id, questions, qIndex]);

  // Next question
  const goNext = () => {
    if (!questions.length) return;
    setQIndex((prev) => (prev + 1) % questions.length);
    setRemaining(totalSeconds);
    setSubmitted(false);
    setShowToast(false);
  };

  // Timer effect
  useEffect(() => {
    if (!timed) return;
    if (remaining <= 0) {
      doSubmit();
      return;
    }
    const id = setInterval(() => setRemaining((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [remaining, doSubmit, timed]);

  // mm:ss
  const mmss = useMemo(() => {
    const m = Math.floor(remaining / 60).toString().padStart(2, "0");
    const s = Math.floor(remaining % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }, [remaining]);

  const cssVars = useMemo(() => paletteToCSSVars(parsePalette(PALETTE_MD)), []);

  return (
    <div className="page-root">
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: cssVars }} />

      {/* Timer */}
      {timed && (
        <div className={`timer-badge ${remaining <= 10 ? "timer-danger" : ""}`} aria-live="polite" aria-atomic="true">
          {mmss}
        </div>
      )}

      {/* Whiteboard */}
      <div className="excalidraw-wrap" aria-label="Whiteboard">
        <Excal
          style={{ width: "100%", height: "100%" }}
          onChange={handleChange}
          viewModeEnabled={submitted}
          gridModeEnabled={false}
          initialData={toScene(questions[qIndex]?.question_body)}
          onMount={(api: ExcalidrawImperativeAPI) => {
            excalAPIRef.current = api;
            const scene = toScene(questions[qIndex]?.question_body);
            api.updateScene(scene);
          }}
        />
      </div>

      {/* Submit / Next */}
      {(!timed || remaining >= 1) ? (
        <div className="submit-bar">
          <button className="btn" onClick={doSubmit} disabled={submitted} aria-disabled={submitted ? "true" : "false"}>
            {submitted ? "Submitted" : "Submit"}
          </button>
        </div>
      ) : (
        qIndex < questions.length - 1 && (
          <div className="submit-bar">
            <button className="btn" onClick={goNext}>Next Question</button>
          </div>
        )
      )}

      {/* Toast */}
      {showToast && (
        <div className="toast" role="status" aria-live="polite">
          <span>Answer submitted</span>
          <button onClick={() => setShowToast(false)} aria-label="Close">Close</button>
        </div>
      )}
    </div>
  );
};

export default Page;