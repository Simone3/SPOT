import { useState } from 'react';
import ButtonsSelect from '../inputs/ButtonsSelect';
import Checkbox from '../inputs/Checkbox';
import TextInput from '../inputs/TextInput';

const TasksFilters = () => {
	const [ text, setText ] = useState('');
	const [ owners, setOwners ] = useState([]);
	const [ dueDates, setDueDates ] = useState([]);
	const [ priorities, setPriorities ] = useState([]);
	const [ tags, setTags ] = useState([]);

	return (
		<div>
			<h3>Search</h3>
			<TextInput
				value={text}
				setValue={setText}
				placeholder='Filter tasks...'/>
			<h3>Priority</h3>
			<ButtonsSelect
				allowMultiSelect={true}
				selected={priorities}
				setSelected={setPriorities}
				options={[
					{ key: 'URGENT', label: 'Urgent', color: 'var(--colors-priority-urgent-faded)' },
					{ key: 'HIGH', label: 'High', color: 'var(--colors-priority-high-faded)' },
					{ key: 'NORMAL', label: 'Normal', color: 'var(--colors-priority-normal-faded)' },
					{ key: 'LOW', label: 'Low', color: 'var(--colors-priority-low-faded)' }
				]}/>
			<h3>Owner</h3>
			<ButtonsSelect
				allowMultiSelect={true}
				selected={owners}
				setSelected={setOwners}
				options={[
					{ key: 'None (me)', label: 'None (me)' },
					{ key: 'Some Person', label: 'Some Person' },
					{ key: 'Somebody', label: 'Somebody' },
					{ key: 'Guy', label: 'Guy' },
					{ key: 'Person', label: 'Person' },
					{ key: 'That Guy', label: 'That Guy' },
					{ key: 'Someone with a long name', label: 'Someone with a long name' }
				]}/>
			<h3>Due Date</h3>
			<ButtonsSelect
				allowMultiSelect={true}
				selected={dueDates}
				setSelected={setDueDates}
				options={[
					{ key: 'None', label: 'None' },
					{ key: 'Today', label: 'Today' },
					{ key: 'Tomorrow', label: 'Tomorrow' },
					{ key: 'February 2, 2025', label: 'February 2, 2025' },
					{ key: 'December 11, 2070', label: 'December 11, 2070' }
				]}/>
			<h3>Tag</h3>
			<ButtonsSelect
				allowMultiSelect={true}
				selected={tags}
				setSelected={setTags}
				options={[
					{ key: 'None', label: 'None' },
					{ key: 'A tag', label: 'A tag' },
					{ key: 'Another tag', label: 'Another tag' }
				]}/>
			<h3>Completed</h3>
			<Checkbox label='Show completed'/>
		</div>
	);
};

export default TasksFilters;
