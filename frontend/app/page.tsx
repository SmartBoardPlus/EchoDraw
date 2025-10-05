import Link from "next/link";
import lectureImage from "./images/lecture.png";
import calculusImage from "./images/calculus.png";
import sessionImage from "./images/session.png";
import placeholderPFP from "./images/placeholder-pfp.png";
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
    <main className="min-h-screen bg-[#f7f7f7] flex flex-col items-center">
      <div className="flex-1 w-full flex flex-col gap-20 items-center">
        <nav className="w-full bg-[#b7dff1] flex justify-center border-b border-b-foreground/10 h-16">
          <div className="w-full max-w-5xl flex justify-between items-center p-3 px-5 text-sm">
            <div className="flex gap-5 items-center font-semibold">
              <Link href={"/"}>About</Link>
              <Link href={"/"}>Sign in</Link>
            </div>
          </div>
        </nav>
        <HomePageIntroduction />
        <div className="flex-1 flex flex-col gap-20 max-w-5xl p-5">
          <main className="flex-1 flex flex-col gap-6 px-2">
            <div className="flex-1 flex flex-row gap-x-10 bg-[#34a8a2] px-8 py-5 rounded-[15px] homepage-description-section">
              <img
                src={lectureImage.src}
                style={{ width: "50%", borderRadius: "25px" }}
              />
              <HomePageDescription
                question="What is this?"
                text="Powered by Next.js, Supabase and the Excalidraw API, we help make learning more engaging by enabling students to get creative!"
              />
            </div>
            <div className="flex-1 flex flex-row gap-x-10 bg-[#007b80] px-8 py-5 rounded-[15px] homepage-description-section">
              <HomePageDescription
                question="How does it work?"
                text="Professors create a session which is presented in the classroom. Students will join the session with just a PIN!"
              />
              <img
                src={sessionImage.src}
                style={{ width: "50%", borderRadius: "25px" }}
              />
            </div>
            <div className="flex-1 flex flex-row gap-x-10 bg-[#34a8a2] px-8 py-5 rounded-[15px] homepage-description-section">
              <img
                src={calculusImage.src}
                style={{ width: "50%", borderRadius: "25px" }}
              />
              <HomePageDescription text="The twist however is that both the instructor and the students must draw to ask or answer questions correctly!" />
            </div>
          </main>
        </div>

        <p className="text-3xl lg:text-4xl !leading-tight mx-[100px] max-w-xl text-center">
          Meet the Crew!
        </p>
        <div className="flex-1 flex flex-col gap-20 max-w-5xl p-5">
          <main className="flex-1 flex flex-col gap-6 px-2">
            <HomePageCrewMember
              name="George"
              description="Description about George"
            />
            <HomePageCrewMember
              name="Ethan"
              description="Description about Ethan"
            />
            <HomePageCrewMember
              name="Kaleel"
              description="Description about Kaleel"
            />
            <HomePageCrewMember
              name="Minh"
              description="Description about Minh"
            />
          </main>
        </div>

        <footer className="w-full flex items-center justify-center border-t mx-auto text-center text-xs gap-8 py-16 bg-[#73c5d4]">
          <p>
            A submission for{" "}
            <a
              href="https://hackthevalley.io/"
              target="_blank"
              className="font-bold hover:underline"
              rel="noreferrer"
            >
              Hack the Valley X
            </a>{" "}
            | Powered by{" "}
            <a
              href="https://supabase.com/?utm_source=create-next-app&utm_medium=template&utm_term=nextjs"
              target="_blank"
              className="font-bold hover:underline"
              rel="noreferrer"
            >
              Supabase
            </a>
          </p>
        </footer>
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

function HomePageIntroduction() {
  return (
    <div className="homepage-introduction">
      <p className="text-3xl lg:text-4xl !leading-tight mx-[100px] max-w-xl text-center">
        MediumBoard, unmatched by Mentimeter
      </p>
    </div>
  );
}

interface HomePageDescriptionProps {
  question?: string;
  text: string;
}

const HomePageDescription: React.FC<HomePageDescriptionProps> = ({
  question = "",
  text,
}) => {
  return (
    <div className={`homepage-description`}>
      {question && question !== "" ? (
        <h2 className="font-medium text-xl mb-4">{question}</h2>
      ) : null}
      <p className="mt-4">{text}</p>
    </div>
  );
};

interface HomePageCrewMemberProps {
  name: string;
  description: string;
}

const HomePageCrewMember: React.FC<HomePageCrewMemberProps> = ({
  name,
  description,
}) => {
  return (
    <div className="flex-1 flex flex-row gap-x-10 bg-[#34a8a2] px-8 py-5 rounded-[15px] homepage-description-section">
      <img
        src={placeholderPFP.src}
        style={{ width: "50%", height: "50%", borderRadius: "50%" }}
      />
      <div className={`homepage-description`}>
        <h2 className="font-medium text-xl mb-4">{name}</h2>
        <p className="mt-4">{description}</p>
      </div>
    </div>
  );
};
