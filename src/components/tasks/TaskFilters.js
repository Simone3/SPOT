import './TaskFilters.css';
import { useState } from 'react';
import ButtonsSelect from '../inputs/ButtonsSelect';
import Checkbox from '../inputs/Checkbox';
import TextInput from '../inputs/TextInput';
import Clickable from '../common/Clickable';
import ResetIcon from '../icons/ResetIcon';

const TaskFilters = () => {
	const [ text, setText ] = useState('');
	const [ owners, setOwners ] = useState([]);
	const [ dueDates, setDueDates ] = useState([]);
	const [ priorities, setPriorities ] = useState([]);
	const [ tags, setTags ] = useState([]);
	const [ showCompleted, setShowCompleted ] = useState(false);

	const doResetDefaults = () => {
		setText('');
		setOwners([]);
		setDueDates([]);
		setPriorities([]);
		setTags([]);
		setShowCompleted(false);
	};

	return (
		<div className='task-filters-container'>
			<div className='task-filters-header-line'>
				<h3 className='task-filters-title'>Filters</h3>
				<div className='task-filters-actions'>
					<Clickable onClick={doResetDefaults}>
						<ResetIcon className='task-filters-reset-icon'/>
						<div className='task-filters-reset-label'>Reset to default</div>
					</Clickable>
				</div>
			</div>
			<TextInput
				label='Filter content'
				placeholder='Search...'
				value={text}
				onChange={setText}/>
			<ButtonsSelect
				label='Filter priorities'
				allowMultiSelect={true}
				value={priorities}
				onChange={setPriorities}
				options={[
					{ key: 'URGENT', label: 'Urgent', color: 'var(--colors-priority-urgent)' },
					{ key: 'HIGH', label: 'High', color: 'var(--colors-priority-high)' },
					{ key: 'NORMAL', label: 'Normal', color: 'var(--colors-priority-normal)' },
					{ key: 'LOW', label: 'Low', color: 'var(--colors-priority-low)' }
				]}/>
			<ButtonsSelect
				label='Filter owners'
				allowMultiSelect={true}
				value={owners}
				onChange={setOwners}
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
				value={dueDates}
				onChange={setDueDates}
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
				value={tags}
				onChange={setTags}
				options={[
					{ key: 'None', label: 'None' },
					{ key: 'A tag', label: 'A tag' },
					{ key: 'Another tag', label: 'Another tag' }
				]}/>
			<Checkbox
				label='Show completed'
				value={showCompleted}
				onChange={setShowCompleted}/>
		</div>
	);
};

export default TaskFilters;
