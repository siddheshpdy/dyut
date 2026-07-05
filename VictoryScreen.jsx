import React from 'react';
import { createPortal } from 'react-dom';
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

  const overlay = (
    <div className="fixed inset-0 z-[140] flex min-h-[100dvh] items-center justify-center overflow-hidden bg-black/76 px-4 py-8 text-center backdrop-blur-sm sm:px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(234,179,8,0.12),transparent_46%)]"></div>

      <section className="relative flex w-full max-w-4xl flex-col items-center rounded-[28px] border border-gold/35 bg-[#070503]/88 px-5 py-7 shadow-[0_0_70px_rgba(0,0,0,0.84),inset_0_0_56px_rgba(234,179,8,0.08)] sm:px-9 sm:py-9 lg:py-10">
        <span className={`${cornerClass} -left-1 -top-1 rounded-tl-[28px] border-l border-t`}></span>
        <span className={`${cornerClass} -right-1 -top-1 rounded-tr-[28px] border-r border-t`}></span>
        <span className={`${cornerClass} -bottom-1 -left-1 rounded-bl-[28px] border-b border-l`}></span>
        <span className={`${cornerClass} -bottom-1 -right-1 rounded-br-[28px] border-b border-r`}></span>

        <div className="mb-3 flex w-full max-w-2xl items-center justify-center gap-3 text-gold/75 sm:mb-4">
          <span className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/70 to-gold/20"></span>
          <span className="h-3 w-3 rotate-45 border border-gold/80 shadow-[0_0_16px_rgba(234,179,8,0.45)]"></span>
          <span className="h-px flex-1 bg-gradient-to-l from-transparent via-gold/70 to-gold/20"></span>
        </div>

        <p className="font-display text-[0.65rem] font-bold uppercase tracking-[0.46em] text-gold/90 drop-shadow-[0_0_8px_rgba(251,191,36,0.28)] sm:text-xs">
          {t('gameOfLegends', 'The Game of Legends')}
        </p>

        <h1 className="dyut-title mt-2 text-[clamp(3.6rem,10vw,7.5rem)] font-bold leading-none tracking-[0.1em] text-[var(--color-gold)] drop-shadow-[0_0_30px_rgba(251,191,36,0.58)] sm:tracking-[0.16em]">
          {t('victory', 'VICTORY')}
        </h1>

        <div className="mt-5 w-full max-w-2xl rounded-2xl border border-gold/28 bg-black/62 px-4 py-4 shadow-[inset_0_0_28px_rgba(0,0,0,0.7)] sm:mt-6 sm:px-8 sm:py-5">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.38em] text-white/85 drop-shadow-[0_0_8px_rgba(0,0,0,0.85)] sm:text-sm">
            {t('champion', 'Champion')}
          </p>
          <h2 className="mt-3 break-words font-display text-[clamp(2.2rem,6.5vw,4.75rem)] font-bold uppercase leading-none tracking-[0.08em] text-gold text-glow-gold">
            {winnerId}
          </h2>
          <p className="mt-3 text-base font-semibold tracking-wide text-[#fff4c7] drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)] sm:text-xl">
            {t('hasWonTheGame', ' has won the game!')}
          </p>
        </div>

        <button
          onClick={handlePlayAgain}
          className="dyut-primary-button mt-6 w-full max-w-xs px-8 py-3 text-base text-[#140b00] [text-shadow:0_1px_0_rgba(255,255,255,0.38)] sm:mt-8 sm:max-w-sm sm:px-14 sm:py-4 sm:text-2xl"
        >
          {t('playAgain', 'Play Again')}
        </button>
      </section>
    </div>
  );

  return typeof document === 'undefined' ? overlay : createPortal(overlay, document.body);
};

export default VictoryScreen;
