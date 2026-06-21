import React from 'react';
import { useTranslation } from 'react-i18next';
import { DYUT_ICONS } from './dyut-icons';

const LanguageSwitcher = () => {
  const { i18n } = useTranslation();
  const LanguageIcon = DYUT_ICONS.language;
  const DropdownIcon = DYUT_ICONS.dropdown;

  const handleLanguageChange = (e) => {
    i18n.changeLanguage(e.target.value);
  };

  return (
    <div className="relative z-20 flex items-center">
      <LanguageIcon className="pointer-events-none absolute left-3 h-4 w-4 text-white/55" aria-hidden="true" />
      <select
        aria-label="Select Language"
        onChange={handleLanguageChange}
        value={i18n.language}
        className="appearance-none bg-black/40 text-white/80 font-sans text-xs sm:text-sm font-semibold h-9 sm:h-10 py-1.5 pl-9 pr-8 rounded-lg border border-white/10 hover:border-white/30 focus:outline-none focus:ring-2 focus:ring-gold/50 cursor-pointer shadow-[0_4px_12px_rgba(0,0,0,0.5)] transition-all"
      >
        <option value="en" className="bg-neutral-800 text-white">English</option>
        <option value="hi" className="bg-neutral-800 text-white">हिन्दी</option>
        <option value="mr" className="bg-neutral-800 text-white">मराठी</option>
      </select>
      <DropdownIcon className="pointer-events-none absolute right-2.5 h-4 w-4 text-white/55" aria-hidden="true" />
    </div>
  );
};

export default LanguageSwitcher;
