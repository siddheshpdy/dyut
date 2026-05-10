import React from 'react';
import { useTranslation } from 'react-i18next';

const AboutScreen = ({ onBack }) => {
  const { t } = useTranslation();

  return (
    <div className="glass-panel p-8 rounded-2xl text-white w-full max-w-2xl max-h-[85vh] overflow-y-auto">
      <h1 className="font-display text-glow-gold text-gold text-4xl font-bold mb-6 text-center">{t('aboutTitle', 'About Us & Contact')}</h1>
      
      <div className="space-y-6 text-left text-sm font-sans text-white/90">
        <section>
          <h2 className="text-xl font-semibold text-gold mb-2 border-b border-white/10 pb-1">{t('aboutDeveloper', 'Developer')}</h2>
          <p className="leading-relaxed">
            {t('aboutDeveloperText', 'This digital adaptation of the classic cross and circle game was developed with passion to bring traditional strategy games to a modern audience.')}
          </p>
        </section>
        
        <section>
          <h2 className="text-xl font-semibold text-gold mb-2 border-b border-white/10 pb-1">{t('aboutContact', 'Contact Us')}</h2>
          <p className="mb-4 leading-relaxed">
            {t('aboutContactText', "Have feedback, found a bug, or just want to say hi? We'd love to hear from you!")}
          </p>
          <div className="flex flex-col gap-3">
             <a href="mailto:support@siddheshpadhye.co.in" className="inline-flex items-center gap-2 text-emerald hover:text-emerald-400 transition-colors font-bold tracking-wide">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" /><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" /></svg>
               support@siddheshpadhye.co.in
             </a>
          </div>
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

export default AboutScreen;