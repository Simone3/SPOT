import './NotesPage.css';
import { Link } from 'react-router';

const NotesPage = () => {
	return (
		<div>
			This is the Notes page!
			<Link to='/'>Go to Tasks</Link>
		</div>
	);
};

export default NotesPage;
