import { DateUtils } from 'src/utils/DateUtils';
import type { CurrentDates } from 'src/types/DateTypes';

const currentDates: CurrentDates = {
	today: {
		date: new Date('2026-05-10T00:00:00'),
		label: 'Today'
	},
	yesterday: {
		date: new Date('2026-05-09T00:00:00'),
		label: 'Yesterday'
	},
	tomorrow: {
		date: new Date('2026-05-11T00:00:00'),
		label: 'Tomorrow'
	},
	fiveDaysAfterTomorrow: [
		{
			date: new Date('2026-05-12T00:00:00'),
			label: 'Tuesday'
		}
	],
	nextWorkingDay: {
		date: new Date('2026-05-11T00:00:00'),
		label: 'Next Workday'
	}
};

describe('DateUtils', () => {
	test('compares dates at day granularity', () => {
		expect(DateUtils.compareDay(new Date('2026-05-10T23:59:59'), new Date('2026-05-10T00:00:00'))).toBe(0);
		expect(DateUtils.compareDay(new Date('2026-05-09T23:59:59'), new Date('2026-05-10T00:00:00'))).toBe(-1);
		expect(DateUtils.compareDay(new Date('2026-05-11T00:00:00'), new Date('2026-05-10T23:59:59'))).toBe(1);
	});

	test('formats smart relative labels before falling back to a full date', () => {
		expect(DateUtils.toSmartString(new Date('2026-05-10T12:00:00'), currentDates)).toBe('Today');
		expect(DateUtils.toSmartString(new Date('2026-05-09T12:00:00'), currentDates)).toBe('Yesterday');
		expect(DateUtils.toSmartString(new Date('2026-05-11T12:00:00'), currentDates)).toBe('Tomorrow');
		expect(DateUtils.toSmartString(new Date('2026-05-12T12:00:00'), currentDates)).toBe('Tuesday');
		expect(DateUtils.toSmartString(new Date('2026-06-01T12:00:00'), currentDates)).toBe('June 1, 2026');
	});

	test('formats stored dates as YYYY-MM-DD strings', () => {
		expect(DateUtils.toStandardYearMonthDay(new Date('2026-05-09T23:59:59'))).toBe('2026-05-09');
		expect(DateUtils.toStandardYearMonthDay(undefined)).toBe('');
		expect(DateUtils.toStandardYearMonthDay(null)).toBe('');
	});

	// Stored due dates must be parsed at local midnight: the native Date constructor reads YYYY-MM-DD as UTC midnight, which shows the previous day in negative UTC offsets
	test('parses stored YYYY-MM-DD strings as local dates', () => {
		expect(DateUtils.fromStandardYearMonthDay('2026-08-03')!.getTime()).toBe(new Date(2026, 7, 3).getTime());
		expect(DateUtils.toStandardYearMonthDay(DateUtils.fromStandardYearMonthDay('2026-08-03'))).toBe('2026-08-03');
		expect(DateUtils.fromStandardYearMonthDay('')).toBeUndefined();
		expect(DateUtils.fromStandardYearMonthDay(undefined)).toBeUndefined();
		expect(DateUtils.fromStandardYearMonthDay(null)).toBeUndefined();
		expect(DateUtils.fromStandardYearMonthDay('not a date')).toBeUndefined();
	});
});
