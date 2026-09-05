import { makeTranslator } from '../testUtils';
import { toDomainOptions } from 'src/components/tasks/DomainOptions';
import type { DomainEntry, DomainLabelKind } from 'src/types/DomainTypes';

const makeDomain = (value: string, labelKind: DomainLabelKind): DomainEntry => {
	return {
		key: `${labelKind}-${value}`,
		value,
		labelKind,
		color: undefined,
		persistent: false,
		count: 1
	};
};

describe('DomainOptions', () => {
	test('words every kind of domain entry, and leaves the ones the tasks name themselves alone', () => {
		const domains: DomainEntry[] = [
			makeDomain('URGENT', 'PRIORITY'),
			makeDomain('', 'NO_OWNER'),
			makeDomain('', 'NO_DUE_DATE'),
			makeDomain('', 'NO_TAGS'),
			makeDomain('Alice', 'VALUE')
		];

		const options = toDomainOptions(domains, makeTranslator());

		expect(options.map((option) => {
			return option.label;
		})).toEqual([ 'Urgent', 'Me', 'None', 'Untagged', 'Alice' ]);
	});

	test('formats the entries the tasks name themselves when asked to, and only those', () => {
		const domains: DomainEntry[] = [
			makeDomain('', 'NO_DUE_DATE'),
			makeDomain('2026-05-10', 'VALUE')
		];

		const options = toDomainOptions(domains, makeTranslator(), (value) => {
			return `formatted ${value}`;
		});

		expect(options[0].label).toBe('None');
		expect(options[1].label).toBe('formatted 2026-05-10');
	});

	test('carries the key and the colour through, since those are not language', () => {
		const priorityDomain: DomainEntry = {
			...makeDomain('HIGH', 'PRIORITY'),
			color: 'var(--colors-priority-high)'
		};

		expect(toDomainOptions([ priorityDomain ], makeTranslator())).toEqual([{
			key: priorityDomain.key,
			value: 'HIGH',
			label: 'High',
			color: 'var(--colors-priority-high)'
		}]);
	});
});
