import MultiSelect from '../inputs/MultiSelect';
import Checkbox from '../inputs/Checkbox';
import TextInput from '../inputs/TextInput';

const TasksFilters = () => {
	return (
		<div>
			<h3>Search</h3>
			<TextInput placeholder='Filter tasks...' />
			<h3>Priority</h3>
			<MultiSelect options={[
				{ key: 'Urgent', label: 'Urgent' },
				{ key: 'High', label: 'High' },
				{ key: 'Normal', label: 'Normal' },
				{ key: 'Low', label: 'Low' }
			]}/>
			<h3>Owner</h3>
			<MultiSelect options={[
				{ key: 'None (me)', label: 'None (me)' },
				{ key: 'Some Person', label: 'Some Person' },
				{ key: 'Somebody', label: 'Somebody' },
				{ key: 'Guy', label: 'Guy' },
				{ key: 'Person', label: 'Person' },
				{ key: 'That Guy', label: 'That Guy' },
				{ key: 'Someone with a long name', label: 'Someone with a long name' }
			]}/>
			<h3>Due Date</h3>
			<MultiSelect options={[
				{ key: 'None', label: 'None' },
				{ key: 'Today', label: 'Today' },
				{ key: 'Tomorrow', label: 'Tomorrow' },
				{ key: 'February 2, 2025', label: 'February 2, 2025' },
				{ key: 'December 11, 2070', label: 'December 11, 2070' }
			]}/>
			<h3>Tag</h3>
			<MultiSelect options={[
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
