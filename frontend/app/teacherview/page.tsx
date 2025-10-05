// "use client";

// import React, { useCallback, useEffect, useMemo, useState } from "react";
// import dynamic from "next/dynamic";
// import { useSearchParams } from "next/navigation";

// // ------------------------------
// // Typed dynamic import of Excalidraw
// // ------------------------------
// type ExcalidrawProps = {
//   initialData?: any;
//   viewModeEnabled?: boolean;
//   gridModeEnabled?: boolean;
//   onChange?: (...args: any[]) => void;
// };

// const Excalidraw = dynamic<ExcalidrawProps>(
//   async () => {
//     const mod: any = await import("@excalidraw/excalidraw");
//     return mod.Excalidraw || mod.default;
//   },
//   { ssr: false, loading: () => <div style={{ padding: 24 }}>Loading whiteboard…</div> }
// );

// // ------------------------------
// // Page Component
// // ------------------------------
// export default function TeacherReviewPage() {
//   const searchParams = useSearchParams();
//   const api = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

//   const questionId = searchParams.get("question_id") || "";

//   // list of answer ids for this question
//   const [answerIds, setAnswerIds] = useState<string[]>([]);
//   // index into the answerIds
//   const [index, setIndex] = useState<number>(0);
//   // current Excalidraw scene to show
//   const [initialData, setInitialData] = useState<any>(null);

//   const [status, setStatus] = useState<string>("Loading…");
//   const [loading, setLoading] = useState<boolean>(true);

//   const hasPrev = index > 0;
//   const hasNext = index < answerIds.length - 1;

//   // fetch the answer list for the question
//   const fetchAnswerList = useCallback(async () => {
//     if (!questionId) {
//       setStatus("Missing question_id");
//       setLoading(false);
//       return;
//     }
//     try {
//       setLoading(true);
//       setStatus("Loading answers…");
//       const res = await fetch(`${api}/api/questions/${questionId}/answers`);
//       if (!res.ok) {
//         const text = await res.text();
//         throw new Error(`List fetch failed: ${res.status} ${text}`);
//       }
//       const rows = (await res.json()) as Array<{ answer_id: string }>;
//       const ids = (rows || []).map((r) => r.answer_id);
//       setAnswerIds(ids);
//       if (ids.length > 0) {
//         setIndex(0);
//       } else {
//         setStatus("No answers yet.");
//       }
//     } catch (e: any) {
//       setStatus(e?.message || String(e));
//     } finally {
//       setLoading(false);
//     }
//   }, [questionId, api]);

//   // load a single answer’s JSON
//   const loadAnswer = useCallback(
//     async (answerId: string) => {
//       try {
//         setStatus("Loading answer…");
//         setLoading(true);
//         const res = await fetch(`${api}/api/answers/${answerId}`);
//         if (!res.ok) {
//           const text = await res.text();
//           throw new Error(`Answer fetch failed: ${res.status} ${text}`);
//         }
//         // backend returns { board_json: {...} }
//         const payload = await res.json();
//         const bj = payload?.board_json || {};
//         // normalize shape for Excalidraw initialData
//         setInitialData({
//           elements: bj.elements ?? [],
//           appState: bj.appState ?? {},
//           files: bj.files ?? {},
//         });
//         setStatus(`Showing ${answerId}`);
//       } catch (e: any) {
//         setStatus(e?.message || String(e));
//       } finally {
//         setLoading(false);
//       }
//     },
//     [api]
//   );

//   // on first load, fetch the answers list
//   useEffect(() => {
//     fetchAnswerList();
//   }, [fetchAnswerList]);

//   // whenever the index changes (and we have IDs), load that answer
//   useEffect(() => {
//     const id = answerIds[index];
//     if (id) loadAnswer(id);
//   }, [index, answerIds, loadAnswer]);

//   // keyboard navigation
//   useEffect(() => {
//     function onKeyDown(e: KeyboardEvent) {
//       if (e.key === "ArrowLeft" && hasPrev) setIndex((i) => i - 1);
//       if (e.key === "ArrowRight" && hasNext) setIndex((i) => i + 1);
//     }
//     window.addEventListener("keydown", onKeyDown);
//     return () => window.removeEventListener("keydown", onKeyDown);
//   }, [hasPrev, hasNext]);

//   return (
//     <div style={{ padding: 16, minHeight: "100vh" }}>
//       <h1 style={{ marginBottom: 8 }}>Teacher Review</h1>
//       <p style={{ marginTop: 0, color: "#666" }}>
//         Question: <code>{questionId || "(none)"}</code>
//       </p>

//       {/* Status line */}
//       <div style={{ margin: "8px 0 16px", color: "#333" }}>{status}</div>

//       {/* Counter + navigation */}
//       <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
//         <button onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={!hasPrev}>
//           ← Prev
//         </button>
//         <span>
//           {answerIds.length > 0 ? `${index + 1} / ${answerIds.length}` : "0 / 0"}
//         </span>
//         <button onClick={() => setIndex((i) => Math.min(answerIds.length - 1, i + 1))} disabled={!hasNext}>
//           Next →
//         </button>
//       </div>

//       {/* Excalidraw canvas */}
//       <div style={{ height: "75vh", border: "1px solid #ddd", borderRadius: 8, overflow: "hidden" }}>
//         <Excalidraw
//           initialData={initialData}
//           viewModeEnabled={true}
//           gridModeEnabled={false}
//           // we don't edit here; just view
//         />
//       </div>

//       {/* Helpful hint */}
//       <div style={{ marginTop: 10, color: "#777" }}>
//         Tip: Use the keyboard ← / → keys to navigate answers.
//       </div>
//     </div>
//   );
// }

"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NextPage } from "next";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";

// Excalidraw CSS
import "@excalidraw/excalidraw/index.css";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

/* ---------------- Palette (example) ---------------- */
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
type Answer = {
  answer_id: string;
  board_json: { elements: any[]; appState: any; files: Record<string, any> } | null;
}

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

    /* Fullscreen timer overlay */
    .timer-full {
      position: fixed; inset: 0;
      display:flex; align-items:center; justify-content:center;
      background: rgba(0,0,0,0.9);
      color: #fff;
      z-index: 100;
      text-align: center;
      padding: 24px;
    }
    .timer-full__time {
      font-weight: 900;
      line-height: 1;
      /* scales from phone to desktop */
      font-size: clamp(4rem, 20vw, 22rem);
      letter-spacing: 0.02em;
      user-select: none;
    }
    .timer-full__actions {
      display:flex; flex-direction:column; gap: 16px; align-items:center;
    }
    .timer-cta {
      margin-top: 24px;
      padding: 18px 28px;
      font-size: clamp(1rem, 2.5vw, 1.5rem);
      font-weight: 800;
      border-radius: 14px;
      border: 1px solid var(--border);
      background: var(--primary);
      color: var(--text);
      cursor: pointer;
    }

    .toast { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); background: var(--surface); color: var(--text); border: 1px solid var(--border); border-radius: 12px; padding: 10px 14px; box-shadow: 0 6px 24px rgba(0,0,0,0.12); display:flex; gap:10px; align-items:center; z-index: 50; }
    .toast button { border: 1px solid var(--border); background: var(--bg); color: var(--text); border-radius: 8px; padding: 6px 8px; cursor: pointer; }
  `;
}

/* ---------------- Excalidraw dynamic import ---------------- */
const ExcalidrawDynamic = dynamic(async () => (await import("@excalidraw/excalidraw")).Excalidraw, {
  ssr: false,
  loading: () => <div>Loading whiteboard…</div>,
});
const Excal = ExcalidrawDynamic as unknown as React.ComponentType<any>;

/* ---------------- Helpers ---------------- */
const toScene = (qb: Question["question_body"] | null | undefined) => {
  const elements = qb?.elements ?? [];
  const files = qb?.files ?? {};
  const rawApp = (qb?.appState ?? {}) as any;
  const app = { ...rawApp };
  if ("collaborators" in app) {
    const c = (app as any).collaborators;
    if (!c || typeof c.forEach !== "function") delete (app as any).collaborators;
  }
  return { elements, appState: app, files };
};
const answerToScene = (ab: Answer["board_json"] | null | undefined) => {
  const elements = ab?.elements ?? [];
  const files = ab?.files ?? {};
  const rawApp = (ab?.appState ?? {}) as any;
  const app = { ...rawApp };
  if ("collaborators" in app) {
    const c = (app as any).collaborators;
    if (!c || typeof c.forEach !== "function") delete (app as any).collaborators;
  }
  return { elements, appState: app, files };
}

/* ---------------- Page ---------------- */
const Page: NextPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const session_Id = useMemo(() => searchParams.get("SessionId") || "-1", [searchParams]);
  const api = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
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
  const [answers,setAnswers] = useState<any[]>([]);
  const [answerIndex,setAnswerIndex] = useState(0);
  const [displayAnswer,setDisplayAnswer] = useState<boolean>(false);
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
        //excalAPIRef.current?.updateScene(firstScene);
        setQIndex(0);
      })
      .catch((e) => console.error("Failed to load questions:", e));
  }, [session_Id]);

  // Update scene on question change
  useEffect(() => {
    if (!excalAPIRef.current) return;
    const scene = toScene(questions[qIndex]?.question_body);
    sceneRef.current = scene;
    //excalAPIRef.current.updateScene(scene);
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
    const payload = {
      elements: snapshot.elements ?? [],
      appState: cleanApp,
      files: snapshot.files ?? {},
      submittedAt: new Date().toISOString(),
    };

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

  // Timer effect (no auto-submit; we show Get Answers instead)
  useEffect(() => {
    if (!timed) return;
    if (remaining <= 0) return;
    const id = setInterval(() => setRemaining((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [remaining, timed]);

  // mm:ss
  const mmss = useMemo(() => {
    const m = Math.floor(remaining / 60).toString().padStart(2, "0");
    const s = Math.floor(remaining % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }, [remaining]);

  const cssVars = useMemo(() => paletteToCSSVars(parsePalette(PALETTE_MD)), []);

  // Navigate to a review page with this question id
  const handleGetAnswers =  async() => {
    const qId=questions[qIndex]?.question_id;
    if (!qId) {
      throw new Error("Missing question_id");
    }
    try {
      const res = await fetch(`${api}/api/questions/${qId}/answers`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`List fetch failed: ${res.status} ${text}`);
      }
      const answers = (await res.json()) as Array<{ answer_id: string, board_json:any }>;
      answers.sort(()=>Math.random()-0.5);  
      console.log(answers); 
      setAnswers(answers || []);
      if (answers.length > 0) {
        
        setAnswerIndex(0);
        const firstAnswerScene = answerToScene(answers?.[0]?.board_json);
        sceneRef.current = firstAnswerScene;
        excalAPIRef.current?.updateScene(firstAnswerScene);
      } else {
        throw new Error("No answers yet.");
      }
    } catch (e: any) {
      console.error(e?.message || String(e));
    } finally {
      setDisplayAnswer(true)
    }
  };

  return (
    <div className="page-root">
      {/* App Router-safe style injection */}
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: cssVars }} />

      {/* Fullscreen timer overlay */}
      {timed && !displayAnswer && (
        <div className="timer-full" aria-live="polite" aria-atomic="true">
          {remaining > 0 ? (
            <div className="timer-full__time">{mmss}</div>
          ) : (
            <div className="timer-full__actions">
              <div className="timer-full__time">00:00</div>
              <button className="timer-cta" onClick={handleGetAnswers}>
                Get Answers
              </button>
            </div>
          )}
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
            const scene = toScene(answers[answerIndex]?.board_json);
            api.updateScene(scene);
          }}
        />
      </div>

      {/* Submit / Next (still available if you want manual submit while timer runs) */}
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