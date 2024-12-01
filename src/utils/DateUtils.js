
export class DateUtils {
	static isSameDay(date1, date2) {
		return date1 &&
			date2 &&
			date1.getFullYear() === date2.getFullYear() &&
			date1.getMonth() === date2.getMonth() &&
			date1.getDate() === date2.getDate();
	}

	static toSmartString(date, currentDates) {
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
}
