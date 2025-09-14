import './TaskFilters.css';
import { useContext } from 'react';
import ButtonsSelect from '../inputs/ButtonsSelect';
import Checkbox from '../inputs/Checkbox';
import TextInput from '../inputs/TextInput';
import Clickable from '../common/Clickable';
import ResetIcon from '../icons/ResetIcon';
import { DatesContext } from '../../contexts/DatesContext';
import { DateUtils } from '../../utils/DateUtils';

const TaskFilters = ({ domains, filters, onFilterChange, onResetDefaultFilters }) => {
	const currentDates = useContext(DatesContext);

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
			{domains.priorities.length > 0 &&
				<ButtonsSelect
					label='Filter priorities'
					allowMultiSelect={true}
					value={filters.priorities}
					onChange={(value) => onFilterChange({ priorities: value })}
					options={domains.priorities}/>
			}
			{domains.owners.length > 0 &&
				<ButtonsSelect
					label='Filter owners'
					allowMultiSelect={true}
					value={filters.owners}
					onChange={(value) => onFilterChange({ owners: value })}
					options={domains.owners}/>
			}
			{domains.dueDates.length > 0 &&
				<ButtonsSelect
					label='Filter due dates'
					allowMultiSelect={true}
					value={filters.dueDates}
					onChange={(value) => onFilterChange({ dueDates: value })}
					options={domains.dueDates.map((dueDateDomain) => ({ ...dueDateDomain, label: !dueDateDomain.value ? dueDateDomain.label : DateUtils.toSmartString(new Date(dueDateDomain.value), currentDates) }))
					}/>
			}
			{domains.tags.length > 0 &&
				<ButtonsSelect
					label='Filter tags'
					allowMultiSelect={true}
					value={filters.tags}
					onChange={(value) => onFilterChange({ tags: value })}
					options={domains.tags}/>
			}
			<Checkbox
				label='Show completed'
				value={filters.showCompleted}
				onChange={(value) => onFilterChange({ showCompleted: value })}
				accentSelectedColor={true}/>
		</div>
	);
};

export default TaskFilters;
