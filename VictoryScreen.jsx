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
    <div className="absolute inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/86 p-2.5 backdrop-blur-md sm:p-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(188,92,27,0.22),transparent_34%),radial-gradient(circle_at_50%_62%,rgba(234,179,8,0.12),transparent_30%)]"></div>
      <div className="relative w-full max-w-3xl overflow-hidden rounded-[26px] border border-gold/45 bg-[#090705]/90 px-4 py-7 text-center shadow-[0_0_65px_rgba(0,0,0,0.84),inset_0_0_45px_rgba(234,179,8,0.08)] sm:rounded-[30px] sm:px-10 sm:py-12">
        <span className={`${cornerClass} -left-1 -top-1 rounded-tl-[30px] border-l border-t`}></span>
        <span className={`${cornerClass} -right-1 -top-1 rounded-tr-[30px] border-r border-t`}></span>
        <span className={`${cornerClass} -bottom-1 -left-1 rounded-bl-[30px] border-b border-l`}></span>
        <span className={`${cornerClass} -bottom-1 -right-1 rounded-br-[30px] border-b border-r`}></span>
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent sm:inset-x-10"></div>
        <div className="pointer-events-none absolute inset-x-10 bottom-0 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent sm:inset-x-14"></div>

        <div className="mb-4 flex items-center justify-center gap-2.5 text-gold/70 sm:mb-5 sm:gap-3">
          <span className="h-px w-10 bg-gradient-to-r from-transparent via-gold/70 to-gold/20 sm:w-24"></span>
          <span className="h-2.5 w-2.5 rotate-45 border border-gold/70"></span>
          <span className="h-px w-10 bg-gradient-to-l from-transparent via-gold/70 to-gold/20 sm:w-24"></span>
        </div>

        <div className="animate-bounce">
          <h1 className="dyut-title text-[clamp(3rem,14vw,4.75rem)] font-bold tracking-[0.12em] text-[var(--color-gold)] drop-shadow-[0_0_30px_rgba(251,191,36,0.6)] sm:text-8xl sm:tracking-[0.22em]">{t('victory', 'VICTORY')}</h1>
        </div>

        <p className="mt-2 font-display text-[10px] font-bold uppercase tracking-[0.24em] text-gold/80 sm:mt-3 sm:text-sm sm:tracking-[0.34em]">
          {t('gameOfLegends', 'The Game of Legends')}
        </p>

        <div className="mx-auto mt-6 max-w-2xl rounded-2xl border border-gold/20 bg-black/35 px-4 py-4 shadow-[inset_0_0_24px_rgba(0,0,0,0.5)] sm:mt-8 sm:px-8 sm:py-5">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-white/55 sm:text-sm">{t('champion', 'Champion')}</p>
          <h2 className="mt-3 font-display text-[2rem] font-bold uppercase tracking-[0.08em] text-gold text-glow-gold sm:text-5xl sm:tracking-[0.12em]">
            {winnerId}
          </h2>
          <p className="mt-3 text-base font-light tracking-wide text-white/80 sm:mt-4 sm:text-xl">
            {t('hasWonTheGame', ' has won the game!')}
          </p>
        </div>

        <div className="mt-7 sm:mt-10">
          <button
            onClick={handlePlayAgain}
            className="dyut-primary-button px-8 py-3 text-base sm:px-14 sm:py-4 sm:text-2xl"
          >
            {t('playAgain', 'Play Again')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VictoryScreen;
