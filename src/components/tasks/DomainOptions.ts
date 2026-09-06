import { getHighestPriorityColor } from 'src/logic/DomainsLogic';
import type { DomainEntry } from 'src/types/DomainTypes';
import type { SpotTranslationKey, SpotTranslator } from 'src/i18n/Translations';
import type { TaskPriorityValue } from 'src/types/TaskTypes';

/**
 * A domain entry with the text to show on it, which is what the select inputs take.
 * The domain logic stays free of any language and says which entry it built; the wording is put on here, where a translator is at hand.
 */
export type DomainOption = {
	key: string;
	value: string;
	label: string;
	color?: string;
	count: number;
	countLabel: string;
	countColor?: string;
};

// A priority is stored as its own value and read as the wording that value stands for
const PRIORITY_LABEL_KEYS: Record<TaskPriorityValue, SpotTranslationKey> = {
	URGENT: 'tasks.priorities.urgent',
	HIGH: 'tasks.priorities.high',
	NORMAL: 'tasks.priorities.normal',
	LOW: 'tasks.priorities.low'
};

/**
 * Returns the text a domain entry shows.
 * @param domain Domain entry to word.
 * @param translator Translator to read the wording from.
 * @param formatValue Formats the entries the tasks name themselves, for a field whose stored value is not what the user reads.
 * @returns The label of the entry.
 */
const getDomainLabel = (domain: DomainEntry, translator: SpotTranslator, formatValue: ((value: string) => string) | undefined): string => {
	switch(domain.labelKind) {
		case 'VALUE':
			return formatValue ? formatValue(domain.value) : domain.value;
		case 'PRIORITY':
			return translator.t(PRIORITY_LABEL_KEYS[domain.value as TaskPriorityValue]);
		case 'NO_OWNER':
			return translator.t('tasks.domains.noOwner');
		case 'NO_DUE_DATE':
			return translator.t('tasks.domains.noDueDate');
		case 'NO_TAGS':
			return translator.t('tasks.domains.noTags');
		default:
			throw Error('Unmapped domain label kind');
	}
};

/**
 * Turns domain entries into the options a select input shows.
 * @param domains Domain entries to word.
 * @param translator Translator to read the wording from.
 * @param formatValue Formats the entries the tasks name themselves, for a field whose stored value is not what the user reads.
 * @returns The options, in the order the domains were given.
 */
export const toDomainOptions = (domains: DomainEntry[], translator: SpotTranslator, formatValue?: (value: string) => string): DomainOption[] => {
	return domains.map((domain) => {
		const label = getDomainLabel(domain, translator, formatValue);

		return {
			key: domain.key,
			value: domain.value,
			label,
			color: domain.color,
			count: domain.count,

			// A bare number beside a label says nothing on its own, so what a control carrying one is called says what it counts
			countLabel: translator.t('tasks.domains.withTaskCount', { label, count: domain.count }),

			// The highest priority behind the entry, which is what the count is tinted with. A priority entry counts tasks that
			// all carry the priority it names, so this is its own colour there: the same rule, read off the same counters.
			countColor: getHighestPriorityColor(domain.priorityCounts)
		};
	});
};
