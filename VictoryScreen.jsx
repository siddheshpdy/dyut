import React from 'react';

const VictoryScreen = ({ winnerId, onNewGame }) => {
  return (
    <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-50 animate-pulse">
      <h1 className="text-6xl font-bold text-yellow-400 drop-shadow-lg">VICTORY!</h1>
      <h2 className="text-3xl text-white mt-4">{winnerId} has won the game!</h2>
      <button
        onClick={onNewGame}
        className="mt-8 px-8 py-3 bg-amber-600 text-white font-bold text-xl rounded-lg shadow-md hover:bg-amber-700 transition-colors"
      >
        Play Again
      </button>
    </div>
  );
};

export default VictoryScreen;