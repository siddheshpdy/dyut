import React from 'react';

const MainMenu = ({ onStart, onResume, onShowRules, canResume }) => {
  return (
    <div className="bg-neutral-800 p-8 rounded-xl shadow-2xl text-white text-center">
      <h1 className="text-5xl font-bold mb-8 tracking-widest">DYUT</h1>
      <div className="flex flex-col items-center gap-4">
        <button 
          onClick={onResume} 
          disabled={!canResume}
          className="w-64 px-6 py-3 bg-green-600 text-white font-bold text-xl rounded-lg shadow-md hover:bg-green-700 disabled:bg-gray-500 disabled:opacity-50 transition-colors"
        >
          Resume Game
        </button>
        <button 
          onClick={onStart} 
          className="w-64 px-6 py-3 bg-blue-600 text-white font-bold text-xl rounded-lg shadow-md hover:bg-blue-700 transition-colors"
        >
          New Game
        </button>
        <button 
          onClick={onShowRules} 
          className="w-64 mt-4 px-4 py-2 bg-gray-600 text-white font-semibold rounded-lg shadow-md hover:bg-gray-700 transition-colors"
        >
          View Rules
        </button>
      </div>
    </div>
  );
};

export default MainMenu;