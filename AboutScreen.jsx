import React from 'react';
import { useTranslation } from 'react-i18next';
import SecondaryScreenShell from './SecondaryScreenShell';

const AboutScreen = ({ onBack }) => {
  const { t } = useTranslation();

  return (
    <SecondaryScreenShell title={t('aboutTitle', 'About Us & Contact')} onBack={onBack} maxWidthClass="max-w-4xl">
      <div className="max-h-[70vh] space-y-7 overflow-y-auto pr-1 text-left text-sm font-sans text-white/88 sm:text-base">
        <section>
          <h2 className="mb-3 border-b border-gold/20 pb-2 font-display text-xl font-semibold uppercase tracking-[0.14em] text-gold">{t('aboutDeveloper', 'Developer')}</h2>
          <p className="leading-7 text-white/82">
            {t('aboutDeveloperText', 'This digital adaptation of the classic cross and circle game was developed with passion to bring traditional strategy games to a modern audience.')}
          </p>
        </section>
        
        <section>
          <h2 className="mb-3 border-b border-gold/20 pb-2 font-display text-xl font-semibold uppercase tracking-[0.14em] text-gold">{t('aboutContact', 'Contact Us')}</h2>
          <p className="mb-4 leading-7 text-white/82">
            {t('aboutContactText', "Have feedback, found a bug, or just want to say hi? We'd love to hear from you!")}
          </p>
          <div className="flex flex-col gap-3">
            {import.meta.env.VITE_IS_PORTAL ? (
              <p className="font-bold tracking-wide text-emerald">Thank you for playing!</p>
            ) : (
              <a href="mailto:support@siddheshpadhye.co.in" className="inline-flex items-center gap-2 font-bold tracking-wide text-emerald transition-colors hover:text-emerald-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" /><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" /></svg>
                support@siddheshpadhye.co.in
              </a>
            )}
          </div>
        </section>
      </div>
    </SecondaryScreenShell>
  );
};

export default AboutScreen;
