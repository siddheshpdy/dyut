import React from 'react';
import { useTranslation } from 'react-i18next';

const HistoryScreen = ({ onBack }) => {
  const { t } = useTranslation();

  return (
    <div className="glass-panel p-8 rounded-2xl text-white w-full max-w-2xl max-h-[85vh] overflow-y-auto">
      <h1 className="font-display text-glow-gold text-gold text-4xl font-bold mb-6 text-center">{t('historyTitle', 'About the Game')}</h1>
      
      <div className="space-y-6 text-left text-sm font-sans text-white/90">
        <section>
          <h2 className="text-xl font-semibold text-gold mb-2 border-b border-white/10 pb-1">{t('historyOrigins', 'Origins')}</h2>
          <p className="leading-relaxed">
            {t('historyOriginsText', 'Dyut is inspired by ancient Indian cross and circle board games such as Chaupar, Chausar, and Pachisi. These games date back thousands of years and have deep cultural significance in Indian history, famously depicted in the epic Mahabharata.')}
          </p>
        </section>
        
        <section>
          <h2 className="text-xl font-semibold text-gold mb-2 border-b border-white/10 pb-1">{t('historyGameplay', 'Gameplay')}</h2>
          <p className="leading-relaxed">
            {t('historyGameplayText', 'Traditional Pachisi is played on a cloth board in the shape of a cross. Pieces move around the board based on the throw of cowrie shells or long dice (pasa). Dyut brings this strategic depth to the digital age, introducing new mechanics like Pair Shields and Dual Spawn Attacks while preserving the core spirit of the classic.')}
          </p>
        </section>
      </div>

      <div className="text-center mt-8">
        <button onClick={onBack} className="px-8 py-3 bg-white/10 border border-white/20 text-white font-bold rounded-xl hover:bg-white/20 transition-colors">
          {t('returnBtn', 'Return')}
        </button>
      </div>
    </div>
  );
};

export default HistoryScreen;