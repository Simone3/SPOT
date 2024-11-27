import './TasksPage.css';
import { Link } from 'react-router';

const TasksPage = () => {
	return (
		<div>
			This is the Tasks page!
			<Link to='/notes'>Go to Notes</Link>
		</div>
	);
};

export default TasksPage;
