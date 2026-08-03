
import type { CurrentDates } from 'src/types/DateTypes';

export class DateUtils {
	static isSameDay(date1: Date, date2: Date): boolean {
		return this.compareDay(date1, date2) === 0;
	}

	static compareDay(date1: Date, date2: Date): number {
		if(!date1 || !date2) {
			throw Error('Invalid empty date(s)');
		}

		if(date1.getFullYear() < date2.getFullYear()) {
			return -1;
		}
		else if(date1.getFullYear() > date2.getFullYear()) {
			return 1;
		}

		if(date1.getMonth() < date2.getMonth()) {
			return -1;
		}
		else if(date1.getMonth() > date2.getMonth()) {
			return 1;
		}

		if(date1.getDate() < date2.getDate()) {
			return -1;
		}
		else if(date1.getDate() > date2.getDate()) {
			return 1;
		}

		return 0;
	}

	static toSmartString(date: Date | undefined, currentDates: CurrentDates): string {
		if(!date) {
			return '';
		}

		if(this.isSameDay(date, currentDates.today.date)) {
			return currentDates.today.label;
		}

		if(this.isSameDay(date, currentDates.yesterday.date)) {
			return currentDates.yesterday.label;
		}

		if(this.isSameDay(date, currentDates.tomorrow.date)) {
			return currentDates.tomorrow.label;
		}

		for(const day of currentDates.fiveDaysAfterTomorrow) {
			if(this.isSameDay(date, day.date)) {
				return day.label;
			}
		}

		return new Intl.DateTimeFormat('en-US', {
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		}).format(date);
	}

	static toStandardYearMonthDay(date: Date | null | undefined): string {
		return date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` : '';
	}

	/**
	 * Parses a stored YYYY-MM-DD string as a local date.
	 * The native Date constructor reads that format as UTC midnight, which shifts the day backwards in negative UTC offsets, so it cannot be used here.
	 * @param value Stored YYYY-MM-DD date string.
	 * @returns The local date, or undefined if the string is empty or malformed.
	 */
	static fromStandardYearMonthDay(value: string | null | undefined): Date | undefined {
		if(!value) {
			return undefined;
		}

		const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
		if(!match) {
			return undefined;
		}

		const [ , year, month, day ] = match;
		const date = new Date(Number(year), Number(month) - 1, Number(day));

		return Number.isNaN(date.getTime()) ? undefined : date;
	}
}
