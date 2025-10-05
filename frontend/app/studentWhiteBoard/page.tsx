"use client";

// pages/index.tsx
// Excalidraw integration fixed per official docs: dynamic import (ssr: false) + CSS import
// Docs: https://docs.excalidraw.com/docs/@excalidraw/excalidraw/integration

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NextPage } from "next";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";

// ✅ Official stylesheet (as per docs). Ensure you installed: `npm i @excalidraw/excalidraw`
// This provides the full Excalidraw toolbar (pencil, text, shapes, etc.)
import "@excalidraw/excalidraw/index.css";

/**
 * Minimal, single-file page that:
 * - Parses a provided palette.md content to define CSS variables (via <style jsx global>).
 * - Renders question image → Excalidraw whiteboard → Submit button (vertical stack).
 * - Shows a countdown badge (default 120s, override with ?t=SECONDS). Auto-submits at 0.
 * - On submit or auto-submit: logs vector JSON payload, locks board (view mode), shows closable toast.
 * - Hotkey: "S" to submit if not already submitted.
 *
 * No extra files, no external CSS. Excalidraw is dynamically imported with ssr: false.
 */

// ⚠️ Replace this string with your palette.md content (you said you'll include it in the prompt).
// We parse it to build CSS variables used across the UI (background, text, primary, etc.).
const PALETTE_MD = `{
"palette-1": "#F7F7F7",
"palette-2": "#B7DFF1",
"palette-3": "#73C5D4",
"palette-4": "#34A8A2",
"palette-5": "#007B80"
}`;

// Dynamic import to avoid SSR issues with the canvas
const Excalidraw = dynamic(
  async () => {
    const mod: any = await import("@excalidraw/excalidraw");
    // The docs export named `Excalidraw`; keep fallbacks for safety across versions
    return mod.Excalidraw || mod.default || (() => <div>Failed to load Excalidraw</div>);
  },
  { ssr: false, loading: () => <div style={{ padding: 24 }}>Loading whiteboard…</div> }
);

// ————— Palette parsing → CSS variables —————
function parsePalette(md: string) {
  const jsonBlock = md.match(/```json\s*([\s\S]*?)\s*```/i);
  if (jsonBlock) {
    try {
      const obj = JSON.parse(jsonBlock[1]);
      const p1 = obj["palette-1"]; // bg
      const p2 = obj["palette-2"]; // muted/border
      const p3 = obj["palette-3"]; // surface
      const p4 = obj["palette-4"]; // primary/accent
      const p5 = obj["palette-5"]; // text/cta
      if ([p1, p2, p3, p4, p5].every(Boolean)) return { p1, p2, p3, p4, p5 };
    } catch {}
  }
  const hexes = Array.from(md.matchAll(/#[0-9a-fA-F]{6}\b/g)).map((m) => m[0]);
  const [p1, p2, p3, p4, p5] = hexes.slice(0, 5);
  return { p1, p2, p3, p4, p5 };
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

// ————— Page —————
const Page: NextPage = () => {
  // Timer: default 120s; override via ?t=SECONDS
  //Timed : defualt true: override via ?Timed=false
  const searchParams = useSearchParams();
  const timed = useMemo(() => {
    const timedParam = searchParams.get("timed");
    return timedParam === "false" ? false : true;
  }, [searchParams]);
  const totalSeconds = useMemo(() => {
    const tParam = searchParams.get("t");
    const parsed = tParam ? parseInt(tParam, 10) : NaN;
    
    return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 24 * 60 * 60) : 120;
  }, [searchParams]);
  
  const [remaining, setRemaining] = useState<number>(totalSeconds);

  // Excalidraw scene state
  const [elements, setElements] = useState<any[]>([]);
  const [appState, setAppState] = useState<any>({});
  const [files, setFiles] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const [showToast, setShowToast] = useState(false);

  // Keep latest scene for submit
  const sceneRef = useRef<{ elements: any[]; appState: any; files: Record<string, any> } | null>(null);

  // onChange signature differs across versions: (elements, appState) or (elements, appState, files)
  const handleChange = useCallback((...args: any[]) => {
    const [els = [], state = {}, f = {}] = args;
    setElements(els);
    setAppState(state);
    setFiles(f);
    sceneRef.current = { elements: els, appState: state, files: f };
  }, []);

  // Submit logic: log vector JSON and lock board
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
      // eslint-disable-next-line no-console
      console.log("SUBMISSION_PAYLOAD:", payload);
      setSubmitted(true); // lock
      setShowToast(true); // toast
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Failed to submit:", err);
    }
  }, [elements, appState, files, submitted]);

  // Countdown
  if(timed){
    useEffect(() => {
      if (submitted) return;
      if (remaining <= 0 && timed) {
        doSubmit();
        return;
      }
      const id = setInterval(() => setRemaining((s) => (s > 0 ? s - 1 : 0)), 1000);
      return () => clearInterval(id);
  }, [remaining, submitted, doSubmit]);
  }
  


  // mm:ss
  const mmss = useMemo(() => {
    const m = Math.floor(remaining / 60)
      .toString()
      .padStart(2, "0");
    const s = Math.floor(remaining % 60)
      .toString()
      .padStart(2, "0");
    return `${m}:${s}`;
  }, [remaining]);

  // CSS vars from palette
  const cssVars = useMemo(() => paletteToCSSVars(parsePalette(PALETTE_MD)), []);

  return (
    <div className="page-root" style={{ minHeight: "100vh" }}>
      {/* Global CSS variables sourced from palette.md */}
      <style jsx global>{`
        ${cssVars}
        html, body, #__next { height: 100%; background: var(--bg); color: var(--text); }
        * { box-sizing: border-box; }

        .page-root { display: flex; flex-direction: column; gap: 16px; padding: 16px; }

        .card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; box-shadow: 0 1px 0 rgba(0,0,0,0.025); }
        .header { position: relative; padding: 12px 12px 0 12px; border-radius: 12px; }

        .question-img { width: 100%; height: auto; display: block; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); }

        .timer-badge { position: fixed; top: 24px; right: 24px; z-index: 30; display: inline-flex; align-items: center; justify-content: center; min-width: 120px; padding: 6px 10px; border-radius: 999px; font-weight: 700; letter-spacing: 0.02em; border: 1px solid var(--border); background: var(--primary); color: var(--text); box-shadow: 0 2px 10px rgba(0,0,0,0.08); font-size: 25px }
        .timer-danger { background: var(--danger); }

        .excalidraw-wrap { height: 97vh; border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }

        .submit-bar { display: flex; justify-content: flex-end; padding: 8px;position: absolute; bottom: 24px; right: 20px; z-index: 30}
        .btn { border: 1px solid var(--border); border-radius: 10px; padding: 10px 16px; background: var(--primary); color: var(--text); font-weight: 600; cursor: pointer; transition: transform .02s ease, filter .15s ease; user-select: none; }
        .btn:hover { filter: brightness(0.95); }
        .btn:active { transform: translateY(1px); }
        .btn[disabled], .btn[aria-disabled="true"] {filter: brightness(80%) cursor: not-allowed; }

        .toast { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); background: var(--surface); color: var(--bg); border: 1px solid var(--border); border-radius: 12px; padding: 12px 16px; box-shadow: 0 6px 24px rgba(0,0,0,0.12); display: flex; align-items: center; gap: 12px; z-index: 40; padding: 7px 10px 7px 20px; }
        .toast button { border: 1px solid var(--border); background: var(--bg); color: var(--text); border-radius: 8px; padding: 6px 8px; cursor: pointer; }
      `}</style>

      {/* Timer */}
      {timed &&(<div className={`timer-badge ${remaining <= 10 ? "timer-danger" : ""}`} aria-live="polite" aria-atomic="true">
        {mmss}
      </div>)}
      

      {/* Question image (top) */}
      {/* Excalidraw whiteboard (middle) — default toolbar shows pencil + text + shapes */}
      <div className="card excalidraw-wrap" aria-label="Whiteboard">
        <Excalidraw
          // @ts-ignore — API types vary across versions
          onChange={handleChange}
          viewModeEnabled={submitted}
          gridModeEnabled={false}
        />
      </div>

      {/* Submit button (bottom) */}
      <div className="submit-bar">
        <button
          className="btn"
          onClick={doSubmit}
          disabled={submitted}
          aria-disabled={submitted ? "true" : "false"}
          aria-label={submitted ? "Already submitted" : "Submit answer (S)"}
          title="Submit answer (S)"
        >
          {submitted ? "Submitted" : "Submit"}
        </button>
      </div>

      {/* Confirmation toast/banner */}
      {showToast && (
        <div className="toast" role="status" aria-live="polite">
          <span>Answer submitted</span>
          <button onClick={() => setShowToast(false)} aria-label="Close notification">
            Close
          </button>
        </div>
      )}
    </div>
  );
};

export default Page;
