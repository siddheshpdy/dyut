import React from 'react';

const MoveSelector = ({ roll, validMoves, onFullMove, onSplitMove, onClose, onInitiatePairAttack, possiblePairAttacks, onNextRoll, hasMultipleRolls }) => {
  if (!roll) return null;

  const isPartialRoll = roll.d2 === null;
  const high = Math.max(roll.d1, roll.d2);
  const low = Math.min(roll.d1, roll.d2);

  // UI for a partial roll (only one move left)
  if (isPartialRoll) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
        <div className="bg-neutral-800 border-2 border-yellow-400 rounded-lg shadow-2xl p-6 flex flex-col gap-3 min-w-[250px] animate-hop" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-white font-bold text-center border-b border-white/20 pb-2">Move Remaining</h3>
          <button
            onClick={() => onFullMove(roll.d1)}
            disabled={!validMoves.sum} // We use 'sum' to check validity for the single move
            className="w-full px-4 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 disabled:bg-gray-500 disabled:opacity-60"
          >
            Move {roll.d1}
          </button>
          {hasMultipleRolls && (
            <button onClick={onNextRoll} className="w-full px-4 py-2 bg-white/10 text-white font-semibold rounded-md hover:bg-white/20 transition-colors mt-1 border border-white/20">
              Use Another Roll
            </button>
          )}
          <button onClick={onClose} className="mt-2 text-yellow-400 text-sm hover:underline">Cancel</button>
        </div>
      </div>
    );
  }

  // UI for a full roll
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-neutral-800 border-2 border-yellow-400 rounded-lg shadow-2xl p-6 flex flex-col gap-3 min-w-[250px] animate-hop" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-white font-bold text-center border-b border-white/20 pb-2">Select Move</h3>
        <button
          onClick={() => onFullMove(roll.sum)}
          disabled={!validMoves.sum}
          className="w-full px-4 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 disabled:bg-gray-500 disabled:opacity-60"
        >
          Move {roll.sum} (Sum)
        </button>
        <button
          onClick={() => onSplitMove(high)}
          disabled={!validMoves.high}
          className="w-full px-4 py-2 bg-sky-600 text-white font-semibold rounded-md hover:bg-sky-700 disabled:bg-gray-500 disabled:opacity-60"
        >
          Move {high} (High)
        </button>
        <button
          onClick={() => onSplitMove(low)}
          disabled={!validMoves.low}
          className="w-full px-4 py-2 bg-cyan-600 text-white font-semibold rounded-md hover:bg-cyan-700 disabled:bg-gray-500 disabled:opacity-60"
        >
          Move {low} (Low)
        </button>
        {/* Render Pair Attack Button */}
        {possiblePairAttacks && possiblePairAttacks.length > 0 && possiblePairAttacks.map(attack => (
          <button
            key={attack.targetCellId}
            onClick={() => onInitiatePairAttack(attack.targetCellId)}
            className="w-full mt-2 px-4 py-2 bg-red-700 text-white font-bold rounded-md hover:bg-red-800 border-2 border-yellow-400 animate-pulse"
          >
            Attack Pair!
          </button>
        ))}
        {hasMultipleRolls && (
          <button onClick={onNextRoll} className="w-full px-4 py-2 bg-white/10 text-white font-semibold rounded-md hover:bg-white/20 transition-colors mt-1 border border-white/20">
            Use Another Roll
          </button>
        )}
        <button onClick={onClose} className="mt-2 text-yellow-400 text-sm hover:underline">Cancel</button>
      </div>
    </div>
  );
};

export default MoveSelector;