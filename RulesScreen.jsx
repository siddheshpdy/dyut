import React from 'react';

// This is a simplified representation of your rules.
// In a real app, you might fetch and parse the markdown file.
const RulesScreen = ({ onBack }) => {
  return (
    <div className="bg-neutral-800 p-6 rounded-xl shadow-2xl text-white max-w-2xl h-[80vh] overflow-y-auto">
      <h1 className="text-3xl font-bold mb-4 text-center">Game Rules</h1>
      
      <div className="space-y-4 text-left text-sm">
        <section>
          <h2 className="text-xl font-semibold text-yellow-400 mb-2">Dicing & Turn Logic</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>Dice have faces: 1, 3, 4, 6.</li>
            <li><strong>Doubles Streak:</strong> Roll doubles (e.g., 4+4) to get another roll. All rolls are queued for your turn.</li>
            <li><strong>Void Rule (1+3):</strong> Rolling a 1 and a 3 forfeits your entire turn immediately.</li>
          </ul>
        </section>
        
        <section>
          <h2 className="text-xl font-semibold text-yellow-400 mb-2">Combat & Safety</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>Landing on a square with a single opponent piece captures it, sending it back to base.</li>
            <li>Squares marked with 'X' are Safe Zones. Pieces here cannot be captured by normal moves.</li>
            <li><strong>Pair Shield:</strong> Two pieces of the same color on one square form a shield and cannot be captured by a single piece.</li>
            <li><strong>Breaking a Shield:</strong> A Pair Shield can only be broken by using a double roll to land two of your pieces on it in the same turn.</li>
            <li><strong>Assassin Rule:</strong> A newly spawning piece CAN capture an opponent on a Safe Zone.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-yellow-400 mb-2">Winning the Game</h2>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Blood Debt:</strong> You must capture at least one opponent piece to unlock your "Home Stretch" (the final column leading to the center).</li>
            <li>Pieces in their Home Stretch are immune to capture.</li>
            <li>The first player to get all 4 pieces to the center goal wins.</li>
            <li>You can overshoot the goal. Any remaining dice value must be used by another piece if possible.</li>
          </ul>
        </section>
      </div>

      <div className="text-center mt-6">
        <button onClick={onBack} className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors">
          Back to Menu
        </button>
      </div>
    </div>
  );
};

export default RulesScreen;