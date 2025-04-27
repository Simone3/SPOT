import './TaskFilters.css';
import { useContext } from 'react';
import ButtonsSelect from '../inputs/ButtonsSelect';
import Checkbox from '../inputs/Checkbox';
import TextInput from '../inputs/TextInput';
import Clickable from '../common/Clickable';
import ResetIcon from '../icons/ResetIcon';
import { DatesContext } from '../../contexts/DatesContexr';
import { DateUtils } from '../../utils/DateUtils';

const TaskFilters = ({ domainLists, filters, onFilterChange, onResetDefaultFilters }) => {
	const currentDates = useContext(DatesContext);

	const filterVisibleDomains = (domain) => {
		// Domains are visible in filters only if they are persistent or if they match the current task state (i.e. all if showing both completed and active, only those of active tasks if showing active tasks only)
		return domain.persistent || filters.showCompleted || domain.activeCount > 0;
	};

	return (
		<div className='task-filters-container'>
			<div className='task-filters-header-line'>
				<h3 className='task-filters-title'>Filters</h3>
				<div className='task-filters-actions'>
					<Clickable onClick={onResetDefaultFilters}>
						<ResetIcon className='task-filters-reset-icon'/>
						<div className='task-filters-reset-label'>Reset to default</div>
					</Clickable>
				</div>
			</div>
			<TextInput
				label='Filter content'
				placeholder='Search...'
				value={filters.text}
				onChange={(value) => onFilterChange({ text: value })}/>
			<ButtonsSelect
				label='Filter priorities'
				allowMultiSelect={true}
				value={filters.priorities}
				onChange={(value) => onFilterChange({ priorities: value })}
				options={domainLists.priorities.filter(filterVisibleDomains)}/>
			<ButtonsSelect
				label='Filter owners'
				allowMultiSelect={true}
				value={filters.owners}
				onChange={(value) => onFilterChange({ owners: value })}
				options={domainLists.owners.filter(filterVisibleDomains)}/>
			<ButtonsSelect
				label='Filter due dates'
				allowMultiSelect={true}
				value={filters.dueDates}
				onChange={(value) => onFilterChange({ dueDates: value })}
				options={domainLists.dueDates
					.filter(filterVisibleDomains)
					.map((dueDateDomain) => ({ ...dueDateDomain, label: !dueDateDomain.value ? dueDateDomain.label : DateUtils.toSmartString(new Date(dueDateDomain.value), currentDates) }))
				}/>
			<ButtonsSelect
				label='Filter tags'
				allowMultiSelect={true}
				value={filters.tags}
				onChange={(value) => onFilterChange({ tags: value })}
				options={domainLists.tags.filter(filterVisibleDomains)}/>
			<Checkbox
				label='Show completed'
				value={filters.showCompleted}
				onChange={(value) => onFilterChange({ showCompleted: value })}/>
		</div>
	);
};

export default TaskFilters;
