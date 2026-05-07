export interface CurrentDateLabel {
	date: Date;
	label: string;
}

export interface CurrentDates {
	today: CurrentDateLabel;
	yesterday: CurrentDateLabel;
	tomorrow: CurrentDateLabel;
	fiveDaysAfterTomorrow: CurrentDateLabel[];
	nextWorkingDay: CurrentDateLabel;
}
