import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enTranslation from './en.json';
import hiTranslation from './hi.json';
import mrTranslation from './mr.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: enTranslation },
      hi: { translation: hiTranslation },
      mr: { translation: mrTranslation }
    },
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false // React already escapes by default
    },
    // Configuration for the language detector
    detection: {
      // Order and from where user language should be detected
      order: ['localStorage', 'navigator'],
      // Cache user language on
      caches: ['localStorage'],
      // Key to use in localStorage
      lookupLocalStorage: 'dyut_lang',
    }
  });

export default i18n;