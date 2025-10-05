"use client";

import Link from "next/link";
import React, { useMemo, useState } from "react";
import type { MouseEventHandler } from "react";
import type { StaticImageData } from "next/image";

import deleteTrueImg from "./assets/delete-trashbin-open.png";
import deleteFalseImg from "./assets/delete-trashbin-closed.png";
import editTrueImg from "./assets/edit-pen-withstroke.png";
import editFalseImg from "./assets/edit-pen-nostroke.png";
import { PenLine } from "lucide-react";
import { useSearchParams } from "next/navigation";

type Session = {
  sessionID: string;
  sessionName: string;
};

export default function Lessons() {
  // Mock data — replace with your JSON fetch later
  const initial: Session[] = useMemo(
    () => [
      { sessionID: "s-101", sessionName: "Algebra — Factoring" },
      { sessionID: "s-102", sessionName: "Physics — Kinematics" },
      { sessionID: "s-103", sessionName: "Chemistry — Stoichiometry" },
    ],
    []
  );
 
  const [lessons, setLessons] = useState<Session[]>(initial);
   const searchParams = useSearchParams();
    const teacherId=React.useMemo(()=>{
      const tParam = searchParams.get("TeacherId"); 
      if(tParam){
        fetch(`http://localhost:8000/api/teachers/${tParam}/sessions`, { method: 'GET' , headers: { 'Content-Type': 'application/json' } }
        ).then(response => response.json()).then(data => {
          if(data.sessions.length==0){
            setLessons([]);
            return;
          }
          const lessons=data.sessions.map((q:any)=>({sessionID:q.session_id,sessionName:q.session_name}));
          console.log(lessons);
          setLessons(lessons);
        }
        ) 
        return tParam
      }
      
       return "-1";
    },[])
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState<string>("");

  const startEdit = (id: string, currentName: string) => {
    setEditingId(id);
    setDraftName(currentName);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraftName("");
  };

  const saveEdit = () => {
    if (!editingId) return;
    setLessons((prev) =>
      prev.map((s) =>
        s.sessionID === editingId ? { ...s, sessionName: draftName.trim() || s.sessionName } : s
      )
    );
    setEditingId(null);
    setDraftName("");
  };
  const addLesson = () => {
    fetch('http://localhost:8000/api/sessions', { method: 'POST' , headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_name:"New Lesson",teacher_id:teacherId }) })
      .then(response => {
        if(response.ok){
          return response.json();
        }else{
          throw new Error('Failed to create session');
        }
        }
        
        )
      .then(data => {
        const newLesson: Session ={sessionID:data.session_id , sessionName: "New Lesson"};
        setLessons((prev) => [...prev, newLesson]);
      }
      )
  }
  const deleteLesson = (id: string) => {
    setLessons((prev) => prev.filter((s) => s.sessionID !== id));
    // TODO: call your API here
    console.log("Deleted lesson:", id);
  };

  return (
    <main className="min-h-screen bg-[#f7f7f7] flex flex-col items-center">
      <div className="flex-1 w-full flex flex-col gap-6 items-center">
        <nav className="w-full bg-[#b7dff1] flex justify-center border-b border-b-foreground/10 h-16">
          <div className="w-full max-w-5xl flex justify-between items-center px-5 text-sm">
            <Link href={"/"}>Home</Link>
            <Link href={"/"}>Log out</Link>
          </div>
        </nav>

        {/* Content container */}
        <div className="w-full max-w-5xl px-5 pb-10">
          <h1 className="text-xl font-semibold mb-3">Lessons / Sessions</h1>

          <ul className="space-y-3">
            {lessons.map((lesson) => (
              <li
                key={lesson.sessionID}
                className="w-full bg-[#b7dff1]/60 border border-[#b7dff1] rounded-lg px-4 py-3"
              >
                
                <LessonRow
                  session={lesson}
                  isEditing={editingId === lesson.sessionID}
                  draftName={editingId === lesson.sessionID ? draftName : ""}
                  onDraftChange={setDraftName}
                  onStartEdit={() => startEdit(lesson.sessionID, lesson.sessionName)}
                  onCancelEdit={cancelEdit}
                  onSaveEdit={saveEdit}
                  onDelete={() => deleteLesson(lesson.sessionID)}
                />
              </li>
            ))}
          </ul>
        </div>
        <button
        onClick={addLesson}
        className="fixed bottom-8 right-8 bg-teal-500 text-white rounded-xl w-40 h-16 flex items-center justify-center gap-2 shadow-lg hover:bg-teal-400 transition-colors"
        >
          <PenLine size={20} strokeWidth={2.5} />
          <span className="font-medium">New Lesson</span>
        </button>
      </div>
    </main>
  );
}

interface BinaryStateButtonProps {
  className?: string;
  hoverSrc: StaticImageData | string;
  idleSrc: StaticImageData | string;
  alt: string;
  onClick: MouseEventHandler<HTMLButtonElement>;
  title?: string;
}

const BinaryStateButton: React.FC<BinaryStateButtonProps> = ({
  className,
  hoverSrc,
  idleSrc,
  alt,
  onClick,
  title,
}) => {
  const [current, setCurrent] = useState<string>(
    typeof idleSrc === "string" ? idleSrc : idleSrc.src
  );

  const hoverURL = typeof hoverSrc === "string" ? hoverSrc : hoverSrc.src;
  const idleURL = typeof idleSrc === "string" ? idleSrc : idleSrc.src;

  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      onMouseEnter={() => setCurrent(hoverURL)}
      onMouseLeave={() => setCurrent(idleURL)}
      title={title}
      aria-label={title || alt}
    >
      {/* Use a plain <img> so swapping src is trivial */}
      <img src={current} alt={alt} className="h-6 w-6" />
    </button>
  );
};

interface LessonRowProps {
  session: Session;
  isEditing: boolean;
  draftName: string;
  onDraftChange: (v: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDelete: () => void;
}

const LessonRow: React.FC<LessonRowProps> = ({
  session,
  isEditing,
  draftName,
  onDraftChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
}) => {
  return (
    <div className="flex items-center justify-between gap-3">
      {/* Left side: name (or editor) */}
      <div className="min-w-0 flex-1">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <input
              className="flex-1 min-w-0 rounded border border-gray-300 bg-white px-2 py-1 text-sm"
              value={draftName}
              onChange={(e) => onDraftChange(e.target.value)}
              placeholder="Lesson name"
              autoFocus
            />
            <Link className="px-3 py-1 rounded bg-[#34a8a2] text-black text-sm" href={`/teacherview?SessionId=${session.sessionID}`}>
              Start
            </Link>
            <button
              className="px-3 py-1 rounded bg-[#34a8a2] text-white text-sm"
              onClick={onSaveEdit}
            >
              Save
            </button>
            <button
              className="px-3 py-1 rounded bg-gray-200 text-gray-800 text-sm"
              onClick={onCancelEdit}
            >
              Cancel
            </button>
          </div>
        ) : (
          <Link href={`/questions?SessionId=${session.sessionID}`}>
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{session.sessionName}</span>
            <span className="text-xs text-gray-600">#{session.sessionID}</span>
          </div>
          </Link>
        )}
      </div>

      {/* Right side: action buttons inline with the name */}
      {!isEditing && (
        <div className="flex items-center gap-2">
          <Link className="px-3 py-1 rounded bg-[#34a8a2] text-black text-sm" href={`/teacherview?SessionId=${session.sessionID}`}>
              Start
            </Link>
          <BinaryStateButton
            title="Edit"
            alt="Edit lesson"
            idleSrc={editFalseImg}
            hoverSrc={editTrueImg}
            onClick={onStartEdit}
          />
          <BinaryStateButton
            title="Delete"
            alt="Delete lesson"
            idleSrc={deleteFalseImg}
            hoverSrc={deleteTrueImg}
            onClick={onDelete}
          />
        </div>
      )}
    </div>
  );
};
