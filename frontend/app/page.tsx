"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { useCallback, useMemo } from "react";

// Images (keep your existing imports)
import lectureImage from "./images/lecture.gif";
import calculusImage from "./images/calculus.gif";
import sessionImage from "./images/session.gif";
import placeholderPFP from "./images/placeholder-pfp.png";
import logoImage from "./images/hack-the-valley-echo-draw.png";
import georgePFP from "./images/linkedin/george.jpg";
import minhPFP from "./images/linkedin/minh.jpg";
import kaleelPFP from "./images/linkedin/kaleel.jpg";

/* ──────────────────────────────────────────────────────────
   Supabase browser client (reads NEXT_PUBLIC_* from .env)
   ────────────────────────────────────────────────────────── */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function Home() {
  const router = useRouter();

  /**
   * Redirects to /auth if no session. Otherwise go to dest.
   * Usage: onClick={guardedNav("/student")}
   */
  const guardedNav = useCallback(
    (dest: string) => async () => {
      const { data } = await supabase.auth.getSession();
      if (!data?.session) {
        router.push("/auth"); // not logged in
      } else {
        router.push(dest);
      }
    },
    [router]
  );

  return (
    <main className="min-h-screen bg-[#f7f7f7] flex flex-col items-center">
      <div className="flex-1 w-full flex flex-col gap-20 items-center">
        {/* NAVBAR */}
        <nav className="w-full bg-[#b7dff1] flex justify-center border-b border-b-foreground/10 h-16">
          <div className="w-full max-w-5xl flex justify-between items-center p-3 px-5 text-sm">
            <div className="flex gap-5 items-center font-semibold">
              <Link href={"/"}>About</Link>
              <Link href={"/auth"}>Sign in</Link>

              {/* Quick student shortcut in navbar */}
              <button
                onClick={guardedNav("/student")}
                className="rounded-md bg-emerald-600 text-white px-3 py-1.5 hover:bg-emerald-500 transition"
                aria-label="Join class as a student"
                title="Join class as a student"
              >
                Student (Join Class)
              </button>
            </div>
          </div>
        </nav>

        <HomePageIntroduction />

        <div className="flex-1 flex flex-col gap-20 max-w-5xl p-5">
          <main className="flex-1 flex flex-col gap-6 px-2">
            {/* Section 1 */}
            <div className="flex-1 flex flex-row gap-x-10 bg-[#34a8a2] px-8 py-5 rounded-[15px] homepage-description-section">
              <img
                src={lectureImage.src}
                style={{
                  width: "50%",
                  objectFit: "contain",
                  borderRadius: "25px",
                }}
                alt="Lecture demo"
              />
              <HomePageDescription
                question="What's EchoDraw?"
                text="As students, we’ve all experienced classrooms where engagement fades quickly — students hesitate to participate for fear of making mistakes, and teachers struggle to identify learning gaps in real time. We were inspired to create EchoDraw to make classrooms more interactive, anonymous, and insightful. By blending collaborative whiteboarding with real-time feedback, EchoDraw helps teachers see what students are thinking without the pressure of raising hands."
              />
            </div>

            {/* Section 2 */}
            <div className="flex-1 flex flex-row gap-x-10 bg-[#007b80] px-8 py-5 rounded-[15px] homepage-description-section">
              <HomePageDescription
                question="How does it work?"
                text={`Powered by Next.js, TailwindCSS, Supabase and the Excalidraw API, EchoDraw allows teachers to create lessons composed of digital whiteboard questions.
Students can join a lesson using a unique code, respond on their own digital whiteboards, and submit their answers anonymously.`}
              />
              <img
                src={sessionImage.src}
                style={{
                  width: "50%",
                  objectFit: "contain",
                  borderRadius: "25px",
                }}
                alt="Session demo"
              />
            </div>

            {/* Section 3 */}
            <div className="flex-1 flex flex-row gap-x-10 bg-[#34a8a2] px-8 py-5 rounded-[15px] homepage-description-section">
              <img
                src={calculusImage.src}
                style={{
                  width: "50%",
                  objectFit: "contain",
                  borderRadius: "25px",
                }}
                alt="Whiteboard demo"
              />
              <HomePageDescription
                text={`Teachers can then:\n
• Shuffle through responses to identify common misconceptions.\n
• Annotate directly on submissions to highlight and correct mistakes.\n
• Compile all responses into a single PDF and export it to their digital classroom platform for review or sharing.\n
• The result is a more engaged classroom, faster feedback loops, and deeper learning.`}
              />
            </div>
          </main>
        </div>

        <p className="text-3xl lg:text-4xl !leading-tight mx-[100px] max-w-xl text-center">
          Meet the Crew!
        </p>

        {/* Crew section (with descriptions preserved) */}
        <div className="flex-1 flex flex-col gap-20 max-w-5xl p-5">
          <main className="flex-1 flex flex-col gap-6 px-2">
            <HomePageCrewMember
              name="George Postica"
              description="Description about George"
              photoSrc={georgePFP.src}
            />
            <HomePageCrewMember
              name="Ethan Diep"
              description="Description about Ethan"
            />
            <HomePageCrewMember
              name="Kaleel Maharaj"
              description="Description about Kaleel"
              photoSrc={kaleelPFP.src}
            />
            <HomePageCrewMember
              name="Nhat Minh Phan"
              description="Description about Minh"
              photoSrc={minhPFP.src}
            />
          </main>
        </div>

        <HomePageGitHubLink
          onStudentClick={guardedNav("/student")}
          onTeacherClick={guardedNav("/lessons")}
        />

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
      </div>
    </main>
  );
}

/* ──────────────────────────────────────────────────────────
   Sections & components (unchanged content preserved)
   ────────────────────────────────────────────────────────── */

function HomePageIntroduction() {
  return (
    <div className="homepage-introduction">
      <img src={logoImage.src} alt="Logo of EchoDraw" id="brand-logo" />
      <p className="text-3xl lg:text-3xl !leading-tight mx-[100px] max-w-xl text-center">
        <i>A real-time collaborative whiteboarding tool for classrooms!</i>
      </p>
    </div>
  );
}

function HomePageGitHubLink({
  onStudentClick,
  onTeacherClick,
}: {
  onStudentClick: () => void;
  onTeacherClick: () => void;
}) {
  return (
    <div className="homepage-github justify-center">
      <p className="text-3xl lg:text-3xl !leading-tight mx-[100px] max-w-xl text-center">
        So what&apos;re you waiting for?
      </p>
      <p className="text-3xl lg:text-3xl !leading-tight mx-[100px] max-w-xl text-center">
        Check out our{" "}
        <a
          href="https://github.com/SmartBoardPlus/EchoDraw"
          className="underline"
          target="_blank"
        >
          GitHub repository
        </a>{" "}
        <b>
          <u>now!</u>
        </b>
      </p>

      {/* Primary CTAs under the hero – now auth-gated */}
      <div className="mt-6 flex items-center justify-center gap-3">
        <button
          onClick={onStudentClick}
          className="rounded-lg bg-emerald-600 text-white px-4 py-2 hover:bg-emerald-500 transition"
        >
          I’m a Student – Join Class
        </button>
        <button
          onClick={onTeacherClick}
          className="rounded-lg border border-zinc-300 px-4 py-2 hover:bg-zinc-100 transition"
        >
          I’m a Teacher – Start Session
        </button>
      </div>
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
  const textLines = useMemo(() => text.split("\n"), [text]);

  return (
    <div className="homepage-description">
      {question && question !== "" ? (
        <h2 className="font-medium text-xl mb-4">{question}</h2>
      ) : null}
      {textLines.map((line, i) => (
        <p key={i} className="mt-4 whitespace-pre-wrap">
          {line}
        </p>
      ))}
    </div>
  );
};

interface HomePageCrewMemberProps {
  name: string;
  description: string;
  photoSrc?: string;
}

const HomePageCrewMember: React.FC<HomePageCrewMemberProps> = ({
  name,
  description,
  photoSrc,
}) => {
  return (
    <div className="flex-1 flex flex-row gap-x-10 bg-[#34a8a2] px-8 pt-10 pb-5 rounded-[15px] homepage-description-section">
      <img
        src={!photoSrc || photoSrc === "" ? placeholderPFP.src : photoSrc}
        alt={`${name} headshot`}
        style={{
          width: "25%",
          height: "25%",
          borderRadius: "50%",
          borderColor: "black",
          borderWidth: "2px",
          objectFit: "contain",
        }}
      />
      <div className="homepage-description">
        <h2 className="font-medium text-xl mb-4">{name}</h2>
        <p className="mt-4">{description}</p>
      </div>
    </div>
  );
};
