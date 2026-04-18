import React from 'react';
import { useTranslation } from 'react-i18next';

const VictoryScreen = ({ winnerId, onNewGame }) => {
  const { t } = useTranslation();

  return (
    <div className="absolute inset-0 bg-charcoal/90 backdrop-blur-md flex flex-col items-center justify-center z-50">
      <div className="animate-bounce">
        <h1 className="font-display text-7xl sm:text-8xl font-bold text-gold tracking-widest drop-shadow-[0_0_30px_rgba(251,191,36,0.6)]">{t('victory')}</h1>
      </div>
      <h2 className="font-sans text-2xl sm:text-3xl text-white mt-6 tracking-wide font-light"><strong className="font-bold text-white">{winnerId}</strong>{t('hasWonTheGame')}</h2>
      <button
        onClick={onNewGame}
        className="mt-12 px-10 py-4 bg-gold text-charcoal font-display font-bold text-xl rounded-2xl shadow-[0_0_20px_rgba(251,191,36,0.5)] hover:scale-105 hover:bg-yellow-400 transition-all"
      >
        {t('playAgain')}
      </button>
    </div>
  );
};

export default VictoryScreen;