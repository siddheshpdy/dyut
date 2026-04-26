import React from 'react';
import { useTranslation } from 'react-i18next';

const MoveSelector = ({ roll, validMoves, onFullMove, onSplitMove, onClose, onInitiatePairAttack, possiblePairAttacks, onNextRoll, hasMultipleRolls, title }) => {
  const { t } = useTranslation();
  if (!roll) return null;

  const isPartialRoll = roll.d2 === null;
  const high = Math.max(roll.d1, roll.d2);
  const low = Math.min(roll.d1, roll.d2);

  // UI for a partial roll (only one move left)
  if (isPartialRoll) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
        <div className="glass-panel border-[1.5px] border-white/20 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] p-6 flex flex-col gap-3 min-w-[260px] animate-hop" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-gold font-display font-bold text-xl text-center border-b border-white/10 pb-3 tracking-widest uppercase">{title || t('moveRemaining')}</h3>
          <button
            onClick={() => onFullMove(roll.d1)}
            disabled={!validMoves.sum} // We use 'sum' to check validity for the single move
            className="w-full px-4 py-3 bg-gold/90 text-charcoal font-sans font-bold rounded-xl hover:bg-gold disabled:bg-white/5 disabled:text-white/30 disabled:border-transparent border border-transparent shadow-[0_0_10px_rgba(251,191,36,0.3)] disabled:shadow-none transition-all"
          >
            {t('move')} {roll.d1}
          </button>
          {hasMultipleRolls && (
            <button onClick={onNextRoll} className="w-full px-4 py-2 bg-transparent text-white/60 font-sans font-medium rounded-xl hover:text-white hover:bg-white/10 transition-colors mt-1 border border-white/10">
              {t('useAnotherRoll')}
            </button>
          )}
          <button onClick={onClose} className="mt-3 text-white/40 text-sm font-sans hover:text-white transition-colors uppercase tracking-wider font-semibold">{t('cancel')}</button>
        </div>
      </div>
    );
  }

  // UI for a full roll
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="glass-panel border-[1.5px] border-white/20 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] p-6 flex flex-col gap-3 min-w-[260px] animate-hop" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-gold font-display font-bold text-xl text-center border-b border-white/10 pb-3 tracking-widest uppercase">{title || t('selectMove')}</h3>
        <button
          onClick={() => onFullMove(roll.sum)}
          disabled={!validMoves.sum}
          className="w-full px-4 py-3 bg-gold/90 text-charcoal font-sans font-bold rounded-xl hover:bg-gold disabled:bg-white/5 disabled:text-white/30 disabled:border-transparent border border-transparent shadow-[0_0_10px_rgba(251,191,36,0.3)] disabled:shadow-none transition-all"
        >
          {t('move')} {roll.sum} ({t('sum')})
        </button>
        <button
          onClick={() => onSplitMove(high)}
          disabled={!validMoves.high}
          className="w-full px-4 py-3 bg-white/10 text-white font-sans font-semibold rounded-xl hover:bg-white/20 disabled:bg-white/5 disabled:text-white/30 border border-white/10 disabled:border-transparent transition-all"
        >
          {t('move')} {high} ({t('high')})
        </button>
        <button
          onClick={() => onSplitMove(low)}
          disabled={!validMoves.low}
          className="w-full px-4 py-3 bg-white/10 text-white font-sans font-semibold rounded-xl hover:bg-white/20 disabled:bg-white/5 disabled:text-white/30 border border-white/10 disabled:border-transparent transition-all"
        >
          {t('move')} {low} ({t('low')})
        </button>
        {/* Render Pair Attack Button */}
        {possiblePairAttacks && possiblePairAttacks.length > 0 && possiblePairAttacks.map(attack => (
          <button
            key={attack.targetCellId}
            onClick={() => onInitiatePairAttack(attack.targetCellId)}
            className="w-full mt-2 px-4 py-3 bg-ruby/90 text-white font-bold rounded-xl hover:bg-ruby shadow-[0_0_15px_rgba(220,38,38,0.5)] border border-ruby/50 animate-pulse transition-all"
          >
            {t('attackPair')}
          </button>
        ))}
        {hasMultipleRolls && (
          <button onClick={onNextRoll} className="w-full px-4 py-2 bg-transparent text-white/60 font-sans font-medium rounded-xl hover:text-white hover:bg-white/10 transition-colors mt-2 border border-white/10">
            {t('useAnotherRoll')}
          </button>
        )}
        <button onClick={onClose} className="mt-3 text-white/40 text-sm font-sans hover:text-white transition-colors uppercase tracking-wider font-semibold">{t('cancel')}</button>
      </div>
    </div>
  );
};

export default MoveSelector;