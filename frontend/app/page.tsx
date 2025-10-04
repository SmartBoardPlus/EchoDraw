import Link from "next/link";
import lectureImage from "./images/lecture.png";
import calculusImage from "./images/calculus.png";
import sessionImage from "./images/session.png";
import placeholderPFP from "./images/placeholder-pfp.png";

export default function Home() {
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
