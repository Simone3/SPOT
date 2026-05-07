import { createContext, useState, type ReactNode } from 'react';
import type { CurrentDates } from '../types/DateTypes';

export const DatesContext = createContext<CurrentDates | undefined>(undefined);

type DatesContextProviderProps = {
	children: ReactNode;
};

export const DatesContextProvider = ({ children }: DatesContextProviderProps) => {
	const [ currentDates ] = useState(() => {
		const initialState = {} as CurrentDates;

		// Today
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		initialState.today = {
			date: today,
			label: 'Today'
		};
	
		// Yesterday
		const yesterday = new Date(today);
		yesterday.setDate(yesterday.getDate() - 1);
		initialState.yesterday = {
			date: yesterday,
			label: 'Yesterday'
		};
	
		// Tomorrow
		const tomorrow = new Date(today);
		tomorrow.setDate(tomorrow.getDate() + 1);
		initialState.tomorrow = {
			date: tomorrow,
			label: 'Tomorrow'
		};
	
		// The 5 days after tomorrow with weekday labels
		initialState.fiveDaysAfterTomorrow = [];
		const loopDate = new Date(tomorrow);
		for(let i = 0; i < 5; i++) {
			loopDate.setDate(loopDate.getDate() + 1);
			initialState.fiveDaysAfterTomorrow.push({
				date: new Date(loopDate),
				label: new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(loopDate)
			});
		}
	
		// Next working day (equal to tomorrow unless Sat or Sun)
		const nextWorkday = new Date(tomorrow);
		while(nextWorkday.getDay() === 0 || nextWorkday.getDay() === 6) {
			nextWorkday.setDate(nextWorkday.getDate() + 1);
		}
		initialState.nextWorkingDay = {
			date: nextWorkday,
			label: 'Next Workday'
		};
	
		return initialState;
	});

	return (
		<DatesContext.Provider
			value={currentDates}>
			{children}
		</DatesContext.Provider>
	);
};
