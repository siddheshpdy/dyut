import React from 'react';
import { useTranslation } from 'react-i18next';
import SecondaryScreenShell from './SecondaryScreenShell';

const HistoryScreen = ({ onBack }) => {
  const { t } = useTranslation();

  return (
    <SecondaryScreenShell title={t('historyTitle', 'About the Game')} onBack={onBack} maxWidthClass="max-w-4xl">
      <div className="max-h-[70vh] space-y-7 overflow-y-auto pr-1 text-left text-sm font-sans text-white/88 sm:text-base">
        <section>
          <h2 className="mb-3 border-b border-gold/20 pb-2 font-display text-xl font-semibold uppercase tracking-[0.14em] text-gold">{t('historyOrigins', 'Origins')}</h2>
          <p className="leading-7 text-white/82">
            {t('historyOriginsText', 'Dyut is inspired by ancient Indian cross and circle board games such as Chaupar, Chausar, and Pachisi. These games date back thousands of years and have deep cultural significance in Indian history, famously depicted in the epic Mahabharata.')}
          </p>
        </section>
        
        <section>
          <h2 className="mb-3 border-b border-gold/20 pb-2 font-display text-xl font-semibold uppercase tracking-[0.14em] text-gold">{t('historyGameplay', 'Gameplay')}</h2>
          <p className="leading-7 text-white/82">
            {t('historyGameplayText', 'Traditional Pachisi is played on a cloth board in the shape of a cross. Pieces move around the board based on the throw of cowrie shells or long dice (pasa). Dyut brings this strategic depth to the digital age, introducing new mechanics like Pair Shields and Dual Spawn Attacks while preserving the core spirit of the classic.')}
          </p>
        </section>
      </div>
    </SecondaryScreenShell>
  );
};

export default HistoryScreen;
