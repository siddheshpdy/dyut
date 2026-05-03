import React from 'react';
import { useTranslation } from 'react-i18next';

const LanguageSwitcher = () => {
  const { i18n } = useTranslation();

  const handleLanguageChange = (e) => {
    i18n.changeLanguage(e.target.value);
  };

  return (
    <div className="absolute top-6 left-6 z-20">
      <select
        aria-label="Select Language"
        onChange={handleLanguageChange}
        value={i18n.language}
        className="appearance-none bg-black/40 text-white/80 font-sans text-sm font-semibold py-1.5 px-3 pr-8 rounded-lg border border-white/10 hover:border-white/30 focus:outline-none focus:ring-2 focus:ring-gold/50 cursor-pointer shadow-[0_4px_12px_rgba(0,0,0,0.5)] transition-all"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(255, 255, 255, 0.6)'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem center', backgroundSize: '1em 1em' }}
      >
        <option value="en" className="bg-neutral-800 text-white">English</option>
        <option value="hi" className="bg-neutral-800 text-white">हिन्दी</option>
        <option value="mr" className="bg-neutral-800 text-white">मराठी</option>
      </select>
    </div>
  );
};

export default LanguageSwitcher;