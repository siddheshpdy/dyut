import React from 'react';
import { useTranslation } from 'react-i18next';

// This is a simplified representation of your rules.
// In a real app, you might fetch and parse the markdown file.
const RulesScreen = ({ onBack }) => {
  const { t } = useTranslation();

  return (
    <div className="glass-panel p-8 rounded-2xl text-white w-full max-w-2xl max-h-[85vh] overflow-y-auto">
      <h1 className="font-display text-glow-gold text-gold text-4xl font-bold mb-6 text-center">{t('gameRules')}</h1>
      
      <div className="space-y-6 text-left text-sm font-sans text-white/90">
        <section>
          <h2 className="text-xl font-semibold text-gold mb-2 border-b border-white/10 pb-1">{t('rulesDicingTitle')}</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>{t('rulesDicing1')}</li>
            <li><strong>{t('rulesDicing2Strong')}</strong>{t('rulesDicing2')}</li>
            <li><strong>{t('rulesDicing3Strong')}</strong>{t('rulesDicing3')}</li>
          </ul>
        </section>
        
        <section>
          <h2 className="text-xl font-semibold text-gold mb-2 border-b border-white/10 pb-1">{t('rulesCombatTitle')}</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>{t('rulesCombat1')}</li>
            <li>{t('rulesCombat2')}</li>
            <li><strong>{t('rulesCombat3Strong')}</strong>{t('rulesCombat3')}</li>
            <li><strong>{t('rulesCombat4Strong')}</strong>{t('rulesCombat4')}</li>
            <li><strong>{t('rulesCombat5Strong')}</strong>{t('rulesCombat5')}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gold mb-2 border-b border-white/10 pb-1">{t('rulesWinningTitle')}</h2>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>{t('rulesWinning1Strong')}</strong>{t('rulesWinning1')}</li>
            <li>{t('rulesWinning2')}</li>
            <li>{t('rulesWinning3')}</li>
            <li>{t('rulesWinning4')}</li>
          </ul>
        </section>
      </div>

      <div className="text-center mt-6">
        <button onClick={onBack} className="px-8 py-3 bg-white/10 border border-white/20 text-white font-bold rounded-xl hover:bg-white/20 transition-colors">
          {t('returnBtn')}
        </button>
      </div>
    </div>
  );
};

export default RulesScreen;