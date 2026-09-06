import { fireEvent, screen } from '@testing-library/react';
import { makePriorityCounts, renderWithTranslations } from '../testUtils';
import { TaskFilters } from 'src/components/tasks/TaskFilters';
import { DateUtils } from 'src/framework/utils/DateUtils';
import { getInitialFilters } from 'src/logic/FiltersLogic';
import type { DomainEntry, FilterDomains } from 'src/types/DomainTypes';

// Due date labels are relative to the real current day, so the fixture has to be too
const todayValue = DateUtils.toStandardYearMonthDay(new Date());

const domains: FilterDomains = {
	priorities: [
		{
			key: 'high',
			value: 'HIGH',
			labelKind: 'PRIORITY',
			color: 'var(--colors-priority-high)',
			persistent: true,
			count: 1,
			priorityCounts: makePriorityCounts({ HIGH: 1 })
		}
	],
	owners: [
		{
			key: 'alice',
			value: 'Alice',
			labelKind: 'VALUE',
			color: undefined,
			persistent: false,
			count: 1,
			priorityCounts: makePriorityCounts({ NORMAL: 1 })
		}
	],
	dueDates: [
		{
			key: 'today',
			value: todayValue,
			labelKind: 'VALUE',
			color: undefined,
			persistent: false,
			count: 1,
			priorityCounts: makePriorityCounts({ NORMAL: 1 })
		}
	],
	tags: [
		{
			key: 'work',
			value: 'work',
			labelKind: 'VALUE',
			color: undefined,
			persistent: false,
			count: 1,
			priorityCounts: makePriorityCounts({ NORMAL: 1 })
		}
	]
};

// The entry the domains carry while some task has no tag at all, worded rather than named after a task value
const untaggedDomain: DomainEntry = {
	key: 'no-tags',
	value: '',
	labelKind: 'NO_TAGS',
	color: undefined,
	persistent: false,
	count: 1,
	priorityCounts: makePriorityCounts({ URGENT: 1 })
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
		fireEvent.click(screen.getByRole('button', { name: 'High, 1 task' }));
		fireEvent.click(screen.getByRole('button', { name: 'Alice, 1 task' }));
		fireEvent.click(screen.getByRole('button', { name: 'Today, 1 task' }));
		fireEvent.click(screen.getByRole('button', { name: 'work, 1 task' }));
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

	test('selects the untagged entry through the empty tag filter value', () => {
		const onFilterChange = vi.fn();

		renderWithTranslations(
			<TaskFilters
				domains={{
					...domains,
					tags: [ untaggedDomain, ...domains.tags ]
				}}
				filters={getInitialFilters()}
				onFilterChange={onFilterChange}
				onResetDefaultFilters={vi.fn()}
			/>
		);

		fireEvent.click(screen.getByRole('button', { name: 'Untagged, 1 task' }));

		expect(onFilterChange).toHaveBeenCalledWith({ tags: [ '' ] });
	});

	test('offers an entry that is the only one in its filter', () => {
		renderWithTranslations(
			<TaskFilters
				domains={{
					...domains,
					tags: [ untaggedDomain ]
				}}
				filters={getInitialFilters()}
				onFilterChange={vi.fn()}
				onResetDefaultFilters={vi.fn()}
			/>
		);

		expect(screen.getByText('Tags')).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Untagged, 1 task' })).toBeTruthy();
	});

	test('shows how many tasks are behind every filter option, tinted by the highest priority in it', () => {
		const alice = {
			...domains.owners[0],
			count: 4,
			priorityCounts: makePriorityCounts({ URGENT: 1, NORMAL: 3 })
		};

		renderWithTranslations(
			<TaskFilters
				domains={{
					...domains,
					owners: [ alice ]
				}}
				filters={getInitialFilters()}
				onFilterChange={vi.fn()}
				onResetDefaultFilters={vi.fn()}
			/>
		);

		const option = screen.getByRole('button', { name: 'Alice, 4 tasks' });
		const count = option.querySelector('.buttons-select-option-count');

		expect(count?.textContent).toBe('4');
		expect((count as HTMLElement).style.color).toBe('var(--colors-priority-urgent)');
	});

	test('shows the content search alone when no task matches any filter', () => {
		renderWithTranslations(
			<TaskFilters
				domains={{
					priorities: [],
					owners: [],
					dueDates: [],
					tags: []
				}}
				filters={getInitialFilters()}
				onFilterChange={vi.fn()}
				onResetDefaultFilters={vi.fn()}
			/>
		);

		expect(screen.getByLabelText('Content')).toBeTruthy();
		expect(screen.getByLabelText('Show completed')).toBeTruthy();
		for(const filterLabel of [ 'Priorities', 'Owners', 'Due dates', 'Tags' ]) {
			expect(screen.queryByText(filterLabel)).toBeNull();
		}
	});
});
