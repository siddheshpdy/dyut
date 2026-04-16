import React from 'react';

const GameSetup = ({ onSelect }) => {
  return (
    <div className="bg-neutral-800 p-8 rounded-xl shadow-2xl text-white text-center">
      <h1 className="text-4xl font-bold mb-6 tracking-widest">DYUT</h1>
      <h2 className="text-xl mb-8 font-light">Select Number of Players</h2>
      <div className="flex justify-center gap-4">
        <button onClick={() => onSelect(2)} className="w-24 h-24 bg-blue-600 rounded-lg text-4xl font-bold hover:bg-blue-700 transition-colors">2</button>
        <button onClick={() => onSelect(3)} className="w-24 h-24 bg-green-600 rounded-lg text-4xl font-bold hover:bg-green-700 transition-colors">3</button>
        <button onClick={() => onSelect(4)} className="w-24 h-24 bg-red-600 rounded-lg text-4xl font-bold hover:bg-red-700 transition-colors">4</button>
      </div>
    </div>
  );
};

export default GameSetup;