import React from 'react';
import { useTranslation } from 'react-i18next';

const cornerClass = 'pointer-events-none absolute h-8 w-8 border-gold/70';

const SecondaryScreenShell = ({
  title,
  onBack,
  children,
  maxWidthClass = 'max-w-3xl',
  backLabel,
  titleClassName = '',
  bodyClassName = '',
}) => {
  const { t } = useTranslation();

  return (
    <div className={`relative w-full ${maxWidthClass}`}>
      <div className="relative overflow-hidden rounded-[28px] border border-gold/45 bg-[#090705]/88 p-5 text-white shadow-[0_0_55px_rgba(0,0,0,0.8),inset_0_0_42px_rgba(234,179,8,0.08)] backdrop-blur-md sm:p-7 lg:p-8">
        <span className={`${cornerClass} -left-1 -top-1 rounded-tl-[28px] border-l border-t`}></span>
        <span className={`${cornerClass} -right-1 -top-1 rounded-tr-[28px] border-r border-t`}></span>
        <span className={`${cornerClass} -bottom-1 -left-1 rounded-bl-[28px] border-b border-l`}></span>
        <span className={`${cornerClass} -bottom-1 -right-1 rounded-br-[28px] border-b border-r`}></span>
        <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent"></div>
        <div className="pointer-events-none absolute inset-x-12 bottom-0 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent"></div>

        <header className="mb-6 text-center sm:mb-8">
          <div className="mb-3 flex items-center justify-center gap-3 text-gold/70">
            <span className="h-px w-12 bg-gradient-to-r from-transparent via-gold/70 to-gold/20 sm:w-20"></span>
            <span className="h-2 w-2 rotate-45 border border-gold/70"></span>
            <span className="h-px w-12 bg-gradient-to-l from-transparent via-gold/70 to-gold/20 sm:w-20"></span>
          </div>
          <h1 className={`dyut-title text-3xl font-bold uppercase tracking-[0.18em] text-gold text-glow-gold sm:text-4xl ${titleClassName}`}>
            {title}
          </h1>
        </header>

        <div className={`space-y-6 text-left text-sm font-sans text-white/85 sm:text-base ${bodyClassName}`}>
          {children}
        </div>

        {onBack && (
          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={onBack}
              className="dyut-secondary-button px-8 py-3 text-sm"
            >
              {backLabel || t('returnBtn', 'Return')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SecondaryScreenShell;
