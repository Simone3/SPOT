import Page from '../common/Page';
import Pane from '../common/Pane';
import TaskFilters from './TaskFilters';
import TasksContainer from './TasksContainer';

const TasksPage = () => {
	return (
		<Page>
			<Pane relativeSize={1}>
				<TaskFilters/>
			</Pane>
			<Pane relativeSize={2}>
				<TasksContainer/>
			</Pane>
		</Page>
	);
};

export default TasksPage;
