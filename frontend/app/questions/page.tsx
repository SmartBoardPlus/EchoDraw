"use client";
import React, { useState ,useMemo } from "react";
import { PenLine } from "lucide-react"; // 🖊️ Import the pen icon
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function CardsPage() {
  const searchParams = useSearchParams();
  const sessionID=React.useMemo(()=>{
    const tParam = searchParams.get("SessionId"); 
    if(tParam){
      fetch(`http://localhost:8000/api/sessions/${tParam}/questions`, { method: 'GET' , headers: { 'Content-Type': 'application/json' } }
      ).then(response => response.json()).then(data => {
        console.log(data);
        const questions=data.map((q:any)=>({id:q.question_id,title:q.question_text,description:"This is the first card."}));
        setCards(questions);
      }
      ) 
      return tParam
    }
    
     return "-1";
  },[])
  if(sessionID=="-1"){
    throw new Error("No Session id provided");
  }
  const [cards, setCards] = useState([
    { id: 1, title: "Card 1", description: "This is the first card." },
    { id: 2, title: "Card 2", description: "This is the second card." },
    { id: 3, title: "Card 3", description: "This is the third card." },
  ]);
  
  // const [loading, setIsLoading] = useState(false);
  //const router=useRouter();
  const addCard = () => {
    fetch('http://localhost:8000/api/questions', { method: 'POST' , headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id:sessionID,question_text:"" }) })
      .then(response => {
        if(response.ok){
          return response.json();
        }else{
          throw new Error('Failed to create session');
        }
        }
        
        )
      .then(data => {
        const newLesson ={id:data.question_Id , title: "New Lesson",description:"This is the first card."};
          setCards((prev) => [...prev, newLesson]);
      }
      )

  };
  // const handleQuestionClick = (id: number) => {
  //   setIsLoading(true);
  //   router.push(`/teacherWhiteBoard?SessionId=${id}`);
    
  // }
  return (
    <div className="min-h-screen bg-gray-100 py-10 px-5 relative">
      <h1 className="text-3xl font-bold text-center text-black mb-8">
        Questions
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {cards.map((card, index) => (
          <Link
            key={card.id}
            className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-300"
            href={`/teacherWhiteBoard?QuestionId=${card.id}`}
          >
            <h2 className="text-xl font-semibold mb-2">{`Question ${index+1}`}</h2>
          </Link>
        ))}
      </div>

      {/* Floating Add Button with Pen Icon */}
      <button
        onClick={addCard}
        className="fixed bottom-8 right-8 bg-teal-500 text-white rounded-xl w-40 h-16 flex items-center justify-center gap-2 shadow-lg hover:bg-teal-400 transition-colors"
      >
        <PenLine size={20} strokeWidth={2.5} />
        <span className="font-medium">New Question</span>
      </button>
    </div>
  );
}
