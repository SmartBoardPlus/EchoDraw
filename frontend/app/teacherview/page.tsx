"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";

// ------------------------------
// Typed dynamic import of Excalidraw
// ------------------------------
type ExcalidrawProps = {
  initialData?: any;
  viewModeEnabled?: boolean;
  gridModeEnabled?: boolean;
  onChange?: (...args: any[]) => void;
};

const Excalidraw = dynamic<ExcalidrawProps>(
  async () => {
    const mod: any = await import("@excalidraw/excalidraw");
    return mod.Excalidraw || mod.default;
  },
  { ssr: false, loading: () => <div style={{ padding: 24 }}>Loading whiteboard…</div> }
);

// ------------------------------
// Page Component
// ------------------------------
export default function TeacherReviewPage() {
  const searchParams = useSearchParams();
  const api = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

  const questionId = searchParams.get("question_id") || "";

  // list of answer ids for this question
  const [answerIds, setAnswerIds] = useState<string[]>([]);
  // index into the answerIds
  const [index, setIndex] = useState<number>(0);
  // current Excalidraw scene to show
  const [initialData, setInitialData] = useState<any>(null);

  const [status, setStatus] = useState<string>("Loading…");
  const [loading, setLoading] = useState<boolean>(true);

  const hasPrev = index > 0;
  const hasNext = index < answerIds.length - 1;

  // fetch the answer list for the question
  const fetchAnswerList = useCallback(async () => {
    if (!questionId) {
      setStatus("Missing question_id");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setStatus("Loading answers…");
      const res = await fetch(`${api}/api/questions/${questionId}/answers`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`List fetch failed: ${res.status} ${text}`);
      }
      const rows = (await res.json()) as Array<{ answer_id: string }>;
      const ids = (rows || []).map((r) => r.answer_id);
      setAnswerIds(ids);
      if (ids.length > 0) {
        setIndex(0);
      } else {
        setStatus("No answers yet.");
      }
    } catch (e: any) {
      setStatus(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [questionId, api]);

  // load a single answer’s JSON
  const loadAnswer = useCallback(
    async (answerId: string) => {
      try {
        setStatus("Loading answer…");
        setLoading(true);
        const res = await fetch(`${api}/api/answers/${answerId}`);
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Answer fetch failed: ${res.status} ${text}`);
        }
        // backend returns { board_json: {...} }
        const payload = await res.json();
        const bj = payload?.board_json || {};
        // normalize shape for Excalidraw initialData
        setInitialData({
          elements: bj.elements ?? [],
          appState: bj.appState ?? {},
          files: bj.files ?? {},
        });
        setStatus(`Showing ${answerId}`);
      } catch (e: any) {
        setStatus(e?.message || String(e));
      } finally {
        setLoading(false);
      }
    },
    [api]
  );

  // on first load, fetch the answers list
  useEffect(() => {
    fetchAnswerList();
  }, [fetchAnswerList]);

  // whenever the index changes (and we have IDs), load that answer
  useEffect(() => {
    const id = answerIds[index];
    if (id) loadAnswer(id);
  }, [index, answerIds, loadAnswer]);

  // keyboard navigation
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft" && hasPrev) setIndex((i) => i - 1);
      if (e.key === "ArrowRight" && hasNext) setIndex((i) => i + 1);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hasPrev, hasNext]);

  return (
    <div style={{ padding: 16, minHeight: "100vh" }}>
      <h1 style={{ marginBottom: 8 }}>Teacher Review</h1>
      <p style={{ marginTop: 0, color: "#666" }}>
        Question: <code>{questionId || "(none)"}</code>
      </p>

      {/* Status line */}
      <div style={{ margin: "8px 0 16px", color: "#333" }}>{status}</div>

      {/* Counter + navigation */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <button onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={!hasPrev}>
          ← Prev
        </button>
        <span>
          {answerIds.length > 0 ? `${index + 1} / ${answerIds.length}` : "0 / 0"}
        </span>
        <button onClick={() => setIndex((i) => Math.min(answerIds.length - 1, i + 1))} disabled={!hasNext}>
          Next →
        </button>
      </div>

      {/* Excalidraw canvas */}
      <div style={{ height: "75vh", border: "1px solid #ddd", borderRadius: 8, overflow: "hidden" }}>
        <Excalidraw
          initialData={initialData}
          viewModeEnabled={true}
          gridModeEnabled={false}
          // we don't edit here; just view
        />
      </div>

      {/* Helpful hint */}
      <div style={{ marginTop: 10, color: "#777" }}>
        Tip: Use the keyboard ← / → keys to navigate answers.
      </div>
    </div>
  );
}
