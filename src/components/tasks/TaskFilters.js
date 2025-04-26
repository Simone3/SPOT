import './TaskFilters.css';
import ButtonsSelect from '../inputs/ButtonsSelect';
import Checkbox from '../inputs/Checkbox';
import TextInput from '../inputs/TextInput';
import Clickable from '../common/Clickable';
import ResetIcon from '../icons/ResetIcon';

const TaskFilters = ({ filters, onFilterChange, onResetDefaultFilters }) => {
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
				options={[
					{ key: 'URGENT', label: 'Urgent', color: 'var(--colors-priority-urgent)' },
					{ key: 'HIGH', label: 'High', color: 'var(--colors-priority-high)' },
					{ key: 'NORMAL', label: 'Normal', color: 'var(--colors-priority-normal)' },
					{ key: 'LOW', label: 'Low', color: 'var(--colors-priority-low)' }
				]}/>
			<ButtonsSelect
				label='Filter owners'
				allowMultiSelect={true}
				value={filters.owners}
				onChange={(value) => onFilterChange({ owners: value })}
				options={[
					{ key: 'None (me)', label: 'None (me)' },
					{ key: 'Some Person', label: 'Some Person' },
					{ key: 'Somebody', label: 'Somebody' },
					{ key: 'Guy', label: 'Guy' },
					{ key: 'Person', label: 'Person' },
					{ key: 'That Guy', label: 'That Guy' },
					{ key: 'Someone with a long name', label: 'Someone with a long name' }
				]}/>
			<ButtonsSelect
				label='Filter due dates'
				allowMultiSelect={true}
				value={filters.dueDates}
				onChange={(value) => onFilterChange({ dueDates: value })}
				options={[
					{ key: 'None', label: 'None' },
					{ key: 'Today', label: 'Today' },
					{ key: 'Tomorrow', label: 'Tomorrow' },
					{ key: 'February 2, 2025', label: 'February 2, 2025' },
					{ key: 'December 11, 2070', label: 'December 11, 2070' }
				]}/>
			<ButtonsSelect
				label='Filter tags'
				allowMultiSelect={true}
				value={filters.tags}
				onChange={(value) => onFilterChange({ tags: value })}
				options={[
					{ key: 'None', label: 'None' },
					{ key: 'A tag', label: 'A tag' },
					{ key: 'Another tag', label: 'Another tag' }
				]}/>
			<Checkbox
				label='Show completed'
				value={filters.showCompleted}
				onChange={(value) => onFilterChange({ showCompleted: value })}/>
		</div>
	);
};

export default TaskFilters;
