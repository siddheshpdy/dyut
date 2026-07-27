import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { dispatchMuteState } from './audio';
import { DYUT_ICONS } from './dyut-icons';
import { useOptionalEconomy } from './EconomyContext';

const CRAZYGAMES_ADS_ENABLED = import.meta.env.VITE_CG_ENABLE_ADS === 'true';
const cornerClass = 'pointer-events-none absolute h-8 w-8 border-gold/75';

const VictoryScreen = ({ winnerId, matchId = null, isPublicMatch = false, onNewGame, onHome }) => {
  const { t } = useTranslation();
  const HomeIcon = DYUT_ICONS.home;
  const economy = useOptionalEconomy();
  const settlement = isPublicMatch && economy?.lastSettlement?.matchId === matchId
    ? economy.lastSettlement
    : null;

  const handleNewGame = () => {
    if (import.meta.env.VITE_IS_PORTAL && CRAZYGAMES_ADS_ENABLED && window.CrazyGames?.SDK) {
      const showAd = async () => {
        try {
          if (window.cgInitPromise) await window.cgInitPromise;
          window.CrazyGames.SDK.ad.requestAd('midgame', {
            adStarted: () => window.dispatchEvent(new CustomEvent('dyut-mute-change', { detail: true })),
            adFinished: () => { dispatchMuteState(); onNewGame(); },
            adError: () => { dispatchMuteState(); onNewGame(); },
          });
        } catch(e) { onNewGame(); }
      };
      showAd();
    } else {
      onNewGame();
    }
  };

  const overlay = (
    <div className="victory-overlay fixed inset-0 z-[140] flex min-h-[100dvh] items-center justify-center overflow-hidden bg-black/76 px-4 py-8 text-center backdrop-blur-sm sm:px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(234,179,8,0.12),transparent_46%)]"></div>

      <section className="victory-card relative flex w-full max-w-4xl flex-col items-center rounded-[28px] border border-gold/45 bg-[#100e0c]/95 px-5 py-7 shadow-[0_0_70px_rgba(0,0,0,0.78),inset_0_0_56px_rgba(234,179,8,0.07)] sm:px-9 sm:py-9 lg:py-10">
        {onHome && (
          <button
            type="button"
            onClick={onHome}
            aria-label={t('home', 'Home')}
            title={t('home', 'Home')}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white/70 transition-colors hover:border-gold/60 hover:bg-gold/10 hover:text-gold sm:right-6 sm:top-6"
          >
            <HomeIcon className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
        <span className={`${cornerClass} -left-1 -top-1 rounded-tl-[28px] border-l border-t`}></span>
        <span className={`${cornerClass} -right-1 -top-1 rounded-tr-[28px] border-r border-t`}></span>
        <span className={`${cornerClass} -bottom-1 -left-1 rounded-bl-[28px] border-b border-l`}></span>
        <span className={`${cornerClass} -bottom-1 -right-1 rounded-br-[28px] border-b border-r`}></span>

        <div className="mb-3 flex w-full max-w-2xl items-center justify-center gap-3 text-gold/75 sm:mb-4">
          <span className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/70 to-gold/20"></span>
          <span className="h-3 w-3 rotate-45 border border-gold/80 shadow-[0_0_16px_rgba(234,179,8,0.45)]"></span>
          <span className="h-px flex-1 bg-gradient-to-l from-transparent via-gold/70 to-gold/20"></span>
        </div>

        <p className="victory-kicker font-display text-[0.65rem] font-bold uppercase tracking-[0.46em] text-gold/90 drop-shadow-[0_0_8px_rgba(251,191,36,0.28)] sm:text-xs">
          {t('gameOfLegends', 'The Game of Legends')}
        </p>

        <h1 className="victory-title dyut-title mt-2 text-[clamp(3.6rem,10vw,7.5rem)] font-bold leading-none tracking-[0.1em] text-[var(--color-gold)] drop-shadow-[0_0_30px_rgba(251,191,36,0.58)] sm:tracking-[0.16em]">
          {t('victory', 'VICTORY')}
        </h1>

        <div className="victory-champion mt-5 w-full max-w-2xl rounded-2xl border border-gold/28 bg-black/62 px-4 py-4 shadow-[inset_0_0_28px_rgba(0,0,0,0.7)] sm:mt-6 sm:px-8 sm:py-5">
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

        {isPublicMatch && (
          <div data-testid="public-match-settlement" className="mt-4 w-full max-w-2xl rounded-xl border border-emerald/30 bg-emerald/8 px-4 py-3 text-sm text-white/80">
            {settlement ? (
              <>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-white/70">{t('matchPool', 'Pool')}</div>
                    <div className="font-bold text-gold">{settlement.grossPool}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-white/70">{t('matchFee', 'Match Fee')}</div>
                    <div className="font-bold text-ruby">-{settlement.matchFee}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-white/70">{t('yourPayout', 'Your Payout')}</div>
                    <div className="font-bold text-emerald">+{settlement.payout}</div>
                  </div>
                </div>
                {settlement.winnerCount > 1 && (
                  <p className="mt-2 text-center text-xs font-semibold text-[#dfffea]">
                    {t(
                      'teamPrizeSettlement',
                      '{{winnerCount}} winning human teammates receive {{prize}} coins each',
                      {
                        winnerCount: settlement.winnerCount,
                        prize: settlement.prizePerWinner,
                      },
                    )}
                  </p>
                )}
              </>
            ) : (
              <span>{t('settlementPending', 'Confirming coin settlement…')}</span>
            )}
          </div>
        )}

        <button
          onClick={handleNewGame}
          className="victory-play-again mt-6 w-full max-w-xs rounded-2xl border border-gold/55 bg-gold/12 px-8 py-3 font-display text-base font-bold uppercase tracking-[0.18em] text-gold shadow-[0_0_24px_rgba(251,191,36,0.26),inset_0_0_22px_rgba(234,179,8,0.08)] transition-all hover:scale-[1.03] hover:bg-gold/20 sm:mt-8 sm:max-w-sm sm:px-14 sm:py-4 sm:text-2xl"
        >
          {t('newGame', 'New Game')}
        </button>
      </section>
    </div>
  );

  return typeof document === 'undefined' ? overlay : createPortal(overlay, document.body);
};

export default VictoryScreen;
