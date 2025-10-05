"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function StudentJoin() {
  const router = useRouter();
  const api = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

  const [input, setInput] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<any>(null);

  const validate = async () => {
    const code = input.trim();
    if (!code) return;

    setChecking(true);
    setError(null);
    setSession(null);

    try {
      const res = await fetch(
        `${api}/api/sessions/resolve/${encodeURIComponent(code)}`
      );
      const raw = await res.text();
      let data: any = null;
      try { data = raw ? JSON.parse(raw) : null; } catch {}

      if (!res.ok || !data?.ok || !data?.session?.session_id) {
        throw new Error(data?.error || raw || `HTTP ${res.status}`);
      }
      setSession(data.session);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setChecking(false);
    }
  };

  const join = () => {
    if (!session) return;

    // Persist for follow-up pages if needed
    if (typeof window !== "undefined") {
      localStorage.setItem("ab_session_id", session.session_id);
      localStorage.setItem("ab_session_code", session.session_code ?? "");
    }

    // Route to your student whiteboard
    router.push(`/studentWhiteBoard?sessionId=${session.session_id}`);
    // If you later switch to a dynamic route:
    // router.push(`/studentWhiteBoard/${session.session_id}`);
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl bg-zinc-900/60 border border-zinc-800 p-6 shadow-lg">
        <h1 className="text-xl font-semibold mb-4">Join as Student</h1>

        <label className="block text-sm mb-2 text-zinc-300">
          Enter Session Code or Session ID
        </label>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none focus:border-indigo-500"
          placeholder="e.g., ABC123 or 1c7c6... (UUID)"
        />

        <div className="mt-3 flex gap-2">
          <button
            onClick={validate}
            disabled={checking || !input.trim()}
            className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-2 disabled:opacity-50"
          >
            {checking ? "Checking..." : "Check Code"}
          </button>

          <button
            onClick={join}
            disabled={!session}
            className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 disabled:opacity-50"
          >
            Join Class
          </button>
        </div>

        {error && <p className="mt-3 text-red-400 text-sm">Error: {error}</p>}

        {session && (
          <div className="mt-3 text-sm text-zinc-300 space-y-1">
            <div>
              <span className="text-zinc-400">Code:</span>{" "}
              {session.session_code ?? "(none)"}
            </div>
            <div>
              <span className="text-zinc-400">Name:</span>{" "}
              {session.session_name ?? "(unnamed)"}
            </div>
            <div className="text-zinc-400">
              Looks good — click “Join Class”.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
