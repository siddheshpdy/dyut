import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import SecondaryScreenShell from './SecondaryScreenShell';

// This is a simplified representation of your rules.
// In a real app, you might fetch and parse the markdown file.
const RulesScreen = ({ onBack }) => {
  const { t } = useTranslation();
  const [activeRuleSection, setActiveRuleSection] = useState(0);

  const sections = [
    {
      title: t('rulesDicingTitle'),
      content: <ul className="list-disc space-y-2 pl-5 marker:text-gold/80"><li>{t('rulesDicing1')}</li><li><strong>{t('rulesDicing2Strong')}</strong>{t('rulesDicing2')}</li><li><strong>{t('rulesDicing3Strong')}</strong>{t('rulesDicing3')}</li></ul>,
    },
    {
      title: t('rulesCombatTitle'),
      content: <ul className="list-disc space-y-2 pl-5 marker:text-gold/80"><li>{t('rulesCombat1')}</li><li>{t('rulesCombat2')}</li><li><strong>{t('rulesCombat3Strong')}</strong>{t('rulesCombat3')}</li><li><strong>{t('rulesCombat4Strong')}</strong>{t('rulesCombat4')}</li><li><strong>{t('rulesCombat5Strong')}</strong>{t('rulesCombat5')}</li><li><strong>{t('rulesCombat6Strong')}</strong>{t('rulesCombat6')}</li></ul>,
    },
    {
      title: t('rulesWinningTitle'),
      content: <ul className="list-disc space-y-2 pl-5 marker:text-gold/80"><li><strong>{t('rulesWinning1Strong')}</strong>{t('rulesWinning1')}</li><li>{t('rulesWinning2')}</li><li>{t('rulesWinning3')}</li><li>{t('rulesWinning4')}</li></ul>,
    },
  ];
  const section = sections[activeRuleSection];

  return (
    <SecondaryScreenShell title={t('gameRules')} onBack={onBack} maxWidthClass="max-w-4xl">
      <div className="rules-screen-body flex min-h-0 flex-col text-left text-sm font-sans text-white/88 sm:text-base">
        <div className="rules-section-tabs mb-5 grid grid-cols-3 gap-2">
          {sections.map((item, index) => (
            <button key={item.title} type="button" onClick={() => setActiveRuleSection(index)} className={`rounded-lg border px-2 py-2 font-display text-[0.65rem] font-bold uppercase tracking-[0.08em] transition-colors sm:text-xs ${activeRuleSection === index ? 'border-gold/70 bg-gold/15 text-[#fff4c7]' : 'border-white/20 bg-black/25 text-white/75 hover:border-gold/45 hover:text-white'}`}>
              {item.title}
            </button>
          ))}
        </div>
        <section className="rules-section-content min-h-0">
          <h2 className="mb-3 border-b border-gold/20 pb-2 font-display text-xl font-semibold uppercase tracking-[0.14em] text-gold">{section.title}</h2>
          {section.content}
        </section>
      </div>
    </SecondaryScreenShell>
  );
};

export default RulesScreen;
