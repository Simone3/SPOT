import { fireEvent, render, screen } from '@testing-library/react';
import { DatesContext } from 'src/contexts/DatesContext';
import { TaskFilters } from 'src/components/tasks/TaskFilters';
import { getInitialFilters } from 'src/logic/FiltersLogic';
import type { CurrentDates } from 'src/types/DateTypes';
import type { FilterDomains } from 'src/types/DomainTypes';

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
	fiveDaysAfterTomorrow: [],
	nextWorkingDay: {
		date: new Date('2026-05-11T00:00:00'),
		label: 'Next Workday'
	}
};

const domains: FilterDomains = {
	priorities: [
		{
			key: 'high',
			value: 'HIGH',
			label: 'High',
			color: 'var(--colors-priority-high)',
			persistent: true,
			count: 1
		}
	],
	owners: [
		{
			key: 'alice',
			value: 'Alice',
			label: 'Alice',
			color: undefined,
			persistent: false,
			count: 1
		}
	],
	dueDates: [
		{
			key: 'today',
			value: '2026-05-10',
			label: '2026-05-10',
			color: undefined,
			persistent: false,
			count: 1
		}
	],
	tags: [
		{
			key: 'work',
			value: 'work',
			label: 'work',
			color: undefined,
			persistent: false,
			count: 1
		}
	]
};

describe('TaskFilters', () => {
	test('renders filter controls and emits focused filter changes', () => {
		const onFilterChange = jest.fn();
		const onResetDefaultFilters = jest.fn();

		render(
			<DatesContext.Provider value={currentDates}>
				<TaskFilters
					domains={domains}
					filters={getInitialFilters()}
					onFilterChange={onFilterChange}
					onResetDefaultFilters={onResetDefaultFilters}
				/>
			</DatesContext.Provider>
		);

		fireEvent.change(screen.getByLabelText('Filter content'), {
			target: {
				value: 'report'
			}
		});
		fireEvent.click(screen.getByRole('button', { name: 'High' }));
		fireEvent.click(screen.getByRole('button', { name: 'Alice' }));
		fireEvent.click(screen.getByRole('button', { name: 'Today' }));
		fireEvent.click(screen.getByRole('button', { name: 'work' }));
		fireEvent.click(screen.getByLabelText('Show completed'));
		fireEvent.click(screen.getByText('Reset to default'));

		expect(onFilterChange).toHaveBeenCalledWith({ text: 'report' });
		expect(onFilterChange).toHaveBeenCalledWith({ priorities: [ 'HIGH' ] });
		expect(onFilterChange).toHaveBeenCalledWith({ owners: [ 'Alice' ] });
		expect(onFilterChange).toHaveBeenCalledWith({ dueDates: [ '2026-05-10' ] });
		expect(onFilterChange).toHaveBeenCalledWith({ tags: [ 'work' ] });
		expect(onFilterChange).toHaveBeenCalledWith({ showCompleted: true });
		expect(onResetDefaultFilters).toHaveBeenCalledTimes(1);
	});
});
