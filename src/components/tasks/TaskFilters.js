import './TaskFilters.css';
import { useContext } from 'react';
import ButtonsSelect from '../inputs/ButtonsSelect';
import Checkbox from '../inputs/Checkbox';
import TextInput from '../inputs/TextInput';
import Header from '../common/Header';
import ResetIcon from '../icons/ResetIcon';
import { DatesContext } from '../../contexts/DatesContext';
import { DateUtils } from '../../utils/DateUtils';

const TaskFilters = ({ domains, filters, onFilterChange, onResetDefaultFilters }) => {
	const currentDates = useContext(DatesContext);

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
		</div>
	);
};

export default TaskFilters;
