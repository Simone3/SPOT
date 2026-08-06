import { fireEvent, screen } from '@testing-library/react';
import { renderWithTranslations } from '../testUtils';
import { TaskFilters } from 'src/components/tasks/TaskFilters';
import { DateUtils } from 'src/framework/utils/DateUtils';
import { getInitialFilters } from 'src/logic/FiltersLogic';
import type { FilterDomains } from 'src/types/DomainTypes';

// Due date labels are relative to the real current day, so the fixture has to be too
const todayValue = DateUtils.toStandardYearMonthDay(new Date());

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
			value: todayValue,
			label: todayValue,
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
		const onFilterChange = vi.fn();
		const onResetDefaultFilters = vi.fn();

		renderWithTranslations(
			<TaskFilters
				domains={domains}
				filters={getInitialFilters()}
				onFilterChange={onFilterChange}
				onResetDefaultFilters={onResetDefaultFilters}
			/>
		);

		fireEvent.change(screen.getByLabelText('Content'), {
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
		expect(onFilterChange).toHaveBeenCalledWith({ dueDates: [ todayValue ] });
		expect(onFilterChange).toHaveBeenCalledWith({ tags: [ 'work' ] });
		expect(onFilterChange).toHaveBeenCalledWith({ showCompleted: true });
		expect(onResetDefaultFilters).toHaveBeenCalledTimes(1);
	});
});
