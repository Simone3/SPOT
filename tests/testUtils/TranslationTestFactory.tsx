import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { TranslationProvider } from 'src/i18n/TranslationContext';
import { createSpotTranslator, type SpotTranslator } from 'src/i18n/Translations';
import type { DomainLabels } from 'src/logic/DomainsLogic';

/**
 * A translator in the language the assertions are written in.
 * Tests assert on English wording on purpose: it is the bundle that defines the keys, so a key that stops existing has to fail somewhere.
 * @returns The English translator.
 */
export const makeTranslator = (): SpotTranslator => {
	return createSpotTranslator('en');
};

/**
 * The labels the pure domain logic needs, in English.
 * @returns Domain labels for the entries the tasks themselves do not name.
 */
export const makeDomainLabels = (): DomainLabels => {
	const translator = makeTranslator();

	return {
		urgent: translator.t('tasks.priorities.urgent'),
		high: translator.t('tasks.priorities.high'),
		normal: translator.t('tasks.priorities.normal'),
		low: translator.t('tasks.priorities.low'),
		noOwner: translator.t('tasks.domains.noOwner'),
		noDueDate: translator.t('tasks.domains.noDueDate'),
		noTags: translator.t('tasks.domains.noTags')
	};
};

/**
 * Renders inside the translation provider, which every component that shows text needs above it.
 * It is passed as a wrapper rather than wrapped around the element, so that "rerender" keeps the provider in place.
 * @param ui Element to render.
 * @param options Render options, minus the wrapper this helper supplies.
 * @returns The render result.
 */
export const renderWithTranslations = (ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>): RenderResult => {
	return render(ui, { ...options, wrapper: TranslationProvider });
};
