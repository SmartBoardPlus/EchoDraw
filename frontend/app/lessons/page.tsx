// Data for the Lessons/Sessions page:
// JSON:
/*
JSON object: {sessionName, sessionID}

JSON objects in a list:

For each session:
Edit icon = Pencil
Delete icon = Trashbin

*/

/*
TODO:

1. Replace Links 'Edit' and 'Delete' with BinaryStateButtons, which show different pictures whenever the
mouse cursor is hovering over them or not (the images are imported)

2. Put the BinaryStateButtons in the same line as the Lesson Name

3. Implement the Edit and Delete.

4. Reduce the gap between the top nav bar and the first Lesson element.

*/

"use client";

import Link from "next/link";
import React, { MouseEventHandler } from "react";
import { useState } from "react";
import deleteTrueImg from "./assets/delete-trashbin-open.png";
import deleteFalseImg from "./assets/delete-trashbin-closed.png";
import editTrueImg from "./assets/edit-pen-withstroke.png";
import editFalseImg from "./assets/edit-pen-nostroke.png";

export default function Lessons() {
  const deleteLesson = () => {
    console.log("Haha");
  };

  return (
    <main className="min-h-screen bg-[#f7f7f7] flex flex-col items-center">
      <div className="flex-1 w-full flex flex-col gap-20 items-center">
        <nav className="w-full bg-[#b7dff1] flex justify-center border-b border-b-foreground/10 h-16">
          <div className="w-full max-w-5xl flex justify-between items-center p-3 px-5 text-sm">
            <div className="flex gap-5 items-center font-semibold">
              <Link href={"/"}>Home</Link>
              <Link href={"/"}>Log out</Link>
            </div>
          </div>
        </nav>

        <Lesson lessonName="Placeholder" />

        <BinaryStateButton
          className="deleteButton"
          onMouseOver={deleteTrueImg.src}
          onMouseExit={deleteFalseImg.src}
          onClickCallback={() => deleteLesson()}
        />
      </div>
    </main>
  );
}

interface BinaryStateButtonProps {
  className: string; // CSS class name
  onMouseOver: string; // Image to be displayed when mouse is hovering on it
  onMouseExit: string; // Image to be displayed when mouse is hovering on it
  onClickCallback: MouseEventHandler<HTMLInputElement>; // Callback function to execute when clicked
}

const BinaryStateButton: React.FC<BinaryStateButtonProps> = ({
  className,
  onMouseOver,
  onMouseExit,
  onClickCallback,
}) => {
  const [currentImage, setCurrentImage] = useState(onMouseExit);

  const onMouseOverFunction = () => {
    setCurrentImage(onMouseOver);
  };

  const onMouseLeaveFunction = () => {
    setCurrentImage(onMouseExit);
  };

  return (
    <div>
      <input
        type="image"
        onClick={onClickCallback}
        onMouseOver={() => onMouseOverFunction}
        onMouseLeave={() => onMouseLeaveFunction}
        src={`url(${currentImage})`}
      ></input>
    </div>
  );
};

interface LessonProps {
  lessonName: string;
}

const Lesson: React.FC<LessonProps> = ({ lessonName }) => {
  return (
    <div className="lesson w-full bg-[#b7dff1] p-5">
      <span>{lessonName}</span>
      <br></br>

      <Link href={"/"}>Edit</Link>
      <br></br>
      <Link href={"/"}>Delete</Link>
    </div>
  );
};
