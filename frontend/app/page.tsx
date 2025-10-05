import Link from "next/link";
import lectureImage from "./images/lecture.png";
import calculusImage from "./images/calculus.png";
import sessionImage from "./images/session.png";
import placeholderPFP from "./images/placeholder-pfp.png";
import logoImage from "./images/hack-the-valley-echo-draw.png";
import georgePFP from "./images/linkedin/george.jpg";
import minhPFP from "./images/linkedin/minh.jpg";
import kaleelPFP from "./images/linkedin/kaleel.jpg";

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
                style={{
                  width: "50%",
                  objectFit: "contain",
                  borderRadius: "25px",
                }}
              />
              <HomePageDescription
                question="What's EchoDraw?"
                text="As students, we’ve all experienced classrooms where engagement fades quickly — students hesitate to participate for fear of making mistakes, and teachers struggle to identify learning gaps in real time. We were inspired to create EchoDraw to make classrooms more interactive, anonymous, and insightful. By blending collaborative whiteboarding with real-time feedback, EchoDraw helps teachers see what students are thinking without the pressure of raising hands."
              />
            </div>
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
              />
            </div>
            <div className="flex-1 flex flex-row gap-x-10 bg-[#34a8a2] px-8 py-5 rounded-[15px] homepage-description-section">
              <img
                src={calculusImage.src}
                style={{
                  width: "50%",
                  objectFit: "contain",
                  borderRadius: "25px",
                }}
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

        <HomePageGitHubLink />

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
      <img src={logoImage.src} alt="Logo of EchoDraw" id="brand-logo"></img>
      <p className="text-3xl lg:text-3xl !leading-tight mx-[100px] max-w-xl text-center">
        <i>A real-time collaborative whiteboarding tool for classrooms!</i>
      </p>
    </div>
  );
}

function HomePageGitHubLink() {
  return (
    <div className="homepage-github justify-center">
      <p>So what're you waiting for?</p>
      <p>
        Check out our <a>GitHub repository</a>{" "}
        <b>
          <u>now!</u>
        </b>
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
  const textToTextArray = (str: string) => {
    return str.split("\n");
  };

  return (
    <div className={`homepage-description`}>
      {question && question !== "" ? (
        <h2 className="font-medium text-xl mb-4">{question}</h2>
      ) : null}
      {textToTextArray(text).map((str) => (
        <p className="mt-4">{str}</p>
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
        src={!photoSrc || photoSrc == "" ? placeholderPFP.src : photoSrc}
        style={{
          width: "25%",
          height: "25%",
          borderRadius: "50%",
          borderColor: "black",
          borderWidth: "2px",
          objectFit: "contain",
        }}
      />
      <div className={`homepage-description`}>
        <h2 className="font-medium text-xl mb-4">{name}</h2>
        <p className="mt-4">{description}</p>
      </div>
    </div>
  );
};
