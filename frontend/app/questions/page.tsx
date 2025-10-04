"use client";
import { useState } from "react";
import { PenLine } from "lucide-react"; // 🖊️ Import the pen icon

export default function CardsPage() {
  const [cards, setCards] = useState([
    { id: 1, title: "Card 1", description: "This is the first card." },
    { id: 2, title: "Card 2", description: "This is the second card." },
    { id: 3, title: "Card 3", description: "This is the third card." },
  ]);

  const addCard = () => {
    const newId = cards.length + 1;
    const newCard = {
      id: newId,
      title: `Card ${newId}`,
      description: `This is card number ${newId}.`,
    };
    setCards([...cards, newCard]);
  };

  return (
    <div className="min-h-screen bg-gray-100 py-10 px-5 relative">
      <h1 className="text-3xl font-bold text-center text-black mb-8">
        Questions
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {cards.map((card) => (
          <div
            key={card.id}
            className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-300"
          >
            <div className="h-40 bg-gray-200 rounded-lg mb-4 flex items-center justify-center">
              <span className="text-gray-400">Image</span>
            </div>
            <h2 className="text-xl font-semibold mb-2">{card.title}</h2>
            <p className="text-gray-600">{card.description}</p>
          </div>
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
