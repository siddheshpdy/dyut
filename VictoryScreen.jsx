import React from 'react';
import { useTranslation } from 'react-i18next';

const CRAZYGAMES_ADS_ENABLED = import.meta.env.VITE_CG_ENABLE_ADS === 'true';
const cornerClass = 'pointer-events-none absolute h-8 w-8 border-gold/75';

const VictoryScreen = ({ winnerId, onNewGame }) => {
  const { t } = useTranslation();

  const handlePlayAgain = () => {
    if (import.meta.env.VITE_IS_PORTAL && CRAZYGAMES_ADS_ENABLED && window.CrazyGames?.SDK) {
      const showAd = async () => {
        try {
          if (window.cgInitPromise) await window.cgInitPromise;
          window.CrazyGames.SDK.ad.requestAd('midgame', {
            adStarted: () => console.log('Ad started'),
            adFinished: () => onNewGame(),
            adError: (error) => { console.error('Ad error', error); onNewGame(); },
          });
        } catch(e) { onNewGame(); }
      };
      showAd();
    } else {
      onNewGame();
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/86 p-4 backdrop-blur-md">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(188,92,27,0.22),transparent_34%),radial-gradient(circle_at_50%_62%,rgba(234,179,8,0.12),transparent_30%)]"></div>
      <div className="relative w-full max-w-3xl overflow-hidden rounded-[30px] border border-gold/45 bg-[#090705]/90 px-6 py-10 text-center shadow-[0_0_65px_rgba(0,0,0,0.84),inset_0_0_45px_rgba(234,179,8,0.08)] sm:px-10 sm:py-12">
        <span className={`${cornerClass} -left-1 -top-1 rounded-tl-[30px] border-l border-t`}></span>
        <span className={`${cornerClass} -right-1 -top-1 rounded-tr-[30px] border-r border-t`}></span>
        <span className={`${cornerClass} -bottom-1 -left-1 rounded-bl-[30px] border-b border-l`}></span>
        <span className={`${cornerClass} -bottom-1 -right-1 rounded-br-[30px] border-b border-r`}></span>
        <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent"></div>
        <div className="pointer-events-none absolute inset-x-14 bottom-0 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent"></div>

        <div className="mb-5 flex items-center justify-center gap-3 text-gold/70">
          <span className="h-px w-16 bg-gradient-to-r from-transparent via-gold/70 to-gold/20 sm:w-24"></span>
          <span className="h-2.5 w-2.5 rotate-45 border border-gold/70"></span>
          <span className="h-px w-16 bg-gradient-to-l from-transparent via-gold/70 to-gold/20 sm:w-24"></span>
        </div>

        <div className="animate-bounce">
          <h1 className="dyut-title text-6xl font-bold tracking-[0.22em] text-[var(--color-gold)] drop-shadow-[0_0_30px_rgba(251,191,36,0.6)] sm:text-8xl">{t('victory', 'VICTORY')}</h1>
        </div>

        <p className="mt-3 font-display text-xs font-bold uppercase tracking-[0.34em] text-gold/80 sm:text-sm">
          {t('gameOfLegends', 'The Game of Legends')}
        </p>

        <div className="mx-auto mt-8 max-w-2xl rounded-2xl border border-gold/20 bg-black/35 px-5 py-5 shadow-[inset_0_0_24px_rgba(0,0,0,0.5)] sm:px-8">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-white/55 sm:text-sm">{t('champion', 'Champion')}</p>
          <h2 className="mt-3 font-display text-3xl font-bold uppercase tracking-[0.12em] text-gold text-glow-gold sm:text-5xl">
            {winnerId}
          </h2>
          <p className="mt-4 text-base font-light tracking-wide text-white/80 sm:text-xl">
            {t('hasWonTheGame', ' has won the game!')}
          </p>
        </div>

        <div className="mt-10">
          <button
            onClick={handlePlayAgain}
            className="rounded-2xl border border-yellow-200/60 bg-gradient-to-b from-yellow-300 via-gold to-amber-700 px-10 py-4 font-display text-lg font-bold uppercase tracking-[0.18em] text-charcoal shadow-[0_0_24px_rgba(251,191,36,0.5),inset_0_2px_12px_rgba(255,255,255,0.35)] transition-all hover:scale-[1.03] hover:brightness-110 sm:px-14 sm:text-2xl"
          >
            {t('playAgain', 'Play Again')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VictoryScreen;
