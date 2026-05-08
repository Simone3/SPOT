import 'src/components/tasks/TaskFilters.css';
import { useContext, type ReactElement } from 'react';
import { ButtonsSelect } from 'src/components/inputs/ButtonsSelect';
import { Checkbox } from 'src/components/inputs/Checkbox';
import { TextInput } from 'src/components/inputs/TextInput';
import { Header } from 'src/components/common/Header';
import { ResetIcon } from 'src/components/icons/ResetIcon';
import { DatesContext } from 'src/contexts/DatesContext';
import { DateUtils } from 'src/utils/DateUtils';
import type { FilterDomains } from 'src/types/DomainTypes';
import type { TaskFilterChange, TaskFilters as TaskFiltersType } from 'src/types/FilterTypes';
import type { TaskPriorityValue } from 'src/types/TaskTypes';

type TaskFiltersProps = {
	domains: FilterDomains;
	filters: TaskFiltersType;
	onFilterChange: (changedFilters: TaskFilterChange) => void;
	onResetDefaultFilters: () => void;
};

const TaskFilters = ({ domains, filters, onFilterChange, onResetDefaultFilters }: TaskFiltersProps): ReactElement => {
	const currentDates = useContext(DatesContext)!;

	return (
		<div className='task-filters-container'>
			<Header
				title={'Filters'}
				actions={[{
					id: 'reset',
					icon: <ResetIcon />,
					label: 'Reset to default',
					onClick: onResetDefaultFilters
				}]}
			/>
			<div className='task-filters'>
				<TextInput
					label='Filter content'
					placeholder='Search...'
					value={filters.text}
					onChange={(value) => {
						return onFilterChange({ text: value });
					}}/>
				{domains.priorities.length > 0 &&
					<ButtonsSelect
						label='Filter priorities'
						allowMultiSelect={true}
						value={filters.priorities}
						onChange={(value) => {
							return onFilterChange({ priorities: value as TaskPriorityValue[] });
						}}
						options={domains.priorities}/>
				}
				{domains.owners.length > 0 &&
					<ButtonsSelect
						label='Filter owners'
						allowMultiSelect={true}
						value={filters.owners}
						onChange={(value) => {
							return onFilterChange({ owners: value as string[] });
						}}
						options={domains.owners}/>
				}
				{domains.dueDates.length > 0 &&
					<ButtonsSelect
						label='Filter due dates'
						allowMultiSelect={true}
						value={filters.dueDates}
						onChange={(value) => {
							return onFilterChange({ dueDates: value as string[] });
						}}
						options={domains.dueDates.map((dueDateDomain) => {
							return { ...dueDateDomain, label: !dueDateDomain.value ? dueDateDomain.label : DateUtils.toSmartString(new Date(dueDateDomain.value), currentDates) };
						})
						}/>
				}
				{domains.tags.length > 0 &&
					<ButtonsSelect
						label='Filter tags'
						allowMultiSelect={true}
						value={filters.tags}
						onChange={(value) => {
							return onFilterChange({ tags: value as string[] });
						}}
						options={domains.tags}/>
				}
				<Checkbox
					label='Show completed'
					value={filters.showCompleted}
					onChange={(value) => {
						return onFilterChange({ showCompleted: value });
					}}
					accentSelectedColor={true}/>
			</div>
		</div>
	);
};

export { TaskFilters };
