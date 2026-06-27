import React from 'react';
import { useTranslation } from 'react-i18next';
import SecondaryScreenShell from './SecondaryScreenShell';

// This is a simplified representation of your rules.
// In a real app, you might fetch and parse the markdown file.
const RulesScreen = ({ onBack }) => {
  const { t } = useTranslation();

  return (
    <SecondaryScreenShell title={t('gameRules')} onBack={onBack} maxWidthClass="max-w-4xl">
      <div className="max-h-[70vh] space-y-7 overflow-y-auto pr-1 text-left text-sm font-sans text-white/88 sm:text-base">
        <section>
          <h2 className="mb-3 border-b border-gold/20 pb-2 font-display text-xl font-semibold uppercase tracking-[0.14em] text-gold">{t('rulesDicingTitle')}</h2>
          <ul className="list-disc space-y-2 pl-5 marker:text-gold/80">
            <li>{t('rulesDicing1')}</li>
            <li><strong>{t('rulesDicing2Strong')}</strong>{t('rulesDicing2')}</li>
            <li><strong>{t('rulesDicing3Strong')}</strong>{t('rulesDicing3')}</li>
          </ul>
        </section>
        
        <section>
          <h2 className="mb-3 border-b border-gold/20 pb-2 font-display text-xl font-semibold uppercase tracking-[0.14em] text-gold">{t('rulesCombatTitle')}</h2>
          <ul className="list-disc space-y-2 pl-5 marker:text-gold/80">
            <li>{t('rulesCombat1')}</li>
            <li>{t('rulesCombat2')}</li>
            <li><strong>{t('rulesCombat3Strong')}</strong>{t('rulesCombat3')}</li>
            <li><strong>{t('rulesCombat4Strong')}</strong>{t('rulesCombat4')}</li>
            <li><strong>{t('rulesCombat5Strong')}</strong>{t('rulesCombat5')}</li>
            <li><strong>{t('rulesCombat6Strong')}</strong>{t('rulesCombat6')}</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 border-b border-gold/20 pb-2 font-display text-xl font-semibold uppercase tracking-[0.14em] text-gold">{t('rulesWinningTitle')}</h2>
          <ul className="list-disc space-y-2 pl-5 marker:text-gold/80">
            <li><strong>{t('rulesWinning1Strong')}</strong>{t('rulesWinning1')}</li>
            <li>{t('rulesWinning2')}</li>
            <li>{t('rulesWinning3')}</li>
            <li>{t('rulesWinning4')}</li>
          </ul>
        </section>
      </div>
    </SecondaryScreenShell>
  );
};

export default RulesScreen;
