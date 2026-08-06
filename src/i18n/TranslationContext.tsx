import { createTranslationContext } from 'src/framework/renderer/TranslationContext';
import { createSpotTranslator, resolveSpotLanguage } from 'src/i18n/Translations';

// The renderer takes the language the browser reports, which in Electron is the one the operating system is set to
const getRequestedLanguages = (): readonly string[] => {
	return typeof navigator === 'undefined' ? [] : [ ...navigator.languages ];
};

const { TranslationProvider, useTranslator, useLanguage } = createTranslationContext({
	createTranslator: createSpotTranslator,
	initialLanguage: resolveSpotLanguage(getRequestedLanguages())
});

export { TranslationProvider, useTranslator, useLanguage };
