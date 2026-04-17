import React from 'react';

// This is a simplified representation of your rules.
// In a real app, you might fetch and parse the markdown file.
const RulesScreen = ({ onBack }) => {
  return (
    <div className="glass-panel p-8 rounded-2xl text-white w-full max-w-2xl max-h-[85vh] overflow-y-auto">
      <h1 className="font-display text-glow-gold text-gold text-4xl font-bold mb-6 text-center">Game Rules</h1>
      
      <div className="space-y-6 text-left text-sm font-sans text-white/90">
        <section>
          <h2 className="text-xl font-semibold text-gold mb-2 border-b border-white/10 pb-1">Dicing & Turn Logic</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>Dice have faces: 1, 3, 4, 6.</li>
            <li><strong>Doubles Streak:</strong> Roll doubles (e.g., 4+4) to get another roll. All rolls are queued for your turn.</li>
            <li><strong>Void Rule (1+3):</strong> Rolling a 1 and a 3 forfeits your entire turn immediately.</li>
          </ul>
        </section>
        
        <section>
          <h2 className="text-xl font-semibold text-gold mb-2 border-b border-white/10 pb-1">Combat & Safety</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>Landing on a square with a single opponent piece captures it, sending it back to base.</li>
            <li>Squares marked with 'X' are Safe Zones. Pieces here cannot be captured by normal moves.</li>
            <li><strong>Pair Shield:</strong> Two pieces of the same color on one square form a shield and cannot be captured by a single piece.</li>
            <li><strong>Breaking a Shield:</strong> A Pair Shield can only be broken by using a double roll to land two of your pieces on it in the same turn.</li>
            <li><strong>Assassin Rule:</strong> A newly spawning piece CAN capture an opponent on a Safe Zone.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gold mb-2 border-b border-white/10 pb-1">Winning the Game</h2>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Blood Debt:</strong> You must capture at least one opponent piece to unlock your "Home Stretch" (the final column leading to the center).</li>
            <li>Pieces in their Home Stretch are immune to capture.</li>
            <li>The first player to get all 4 pieces to the center goal wins.</li>
            <li>You can overshoot the goal. Any remaining dice value must be used by another piece if possible.</li>
          </ul>
        </section>
      </div>

      <div className="text-center mt-6">
        <button onClick={onBack} className="px-8 py-3 bg-white/10 border border-white/20 text-white font-bold rounded-xl hover:bg-white/20 transition-colors">
          Return
        </button>
      </div>
    </div>
  );
};

export default RulesScreen;