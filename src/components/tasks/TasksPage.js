import Page from '../common/Page';
import Pane from '../common/Pane';
import TasksFilters from './TasksFilters';
import TasksContainer from './TasksContainer';

const TasksPage = () => {
	return (
		<Page>
			<Pane relativeSize={1}>
				<TasksFilters/>
			</Pane>
			<Pane relativeSize={2}>
				<TasksContainer/>
			</Pane>
		</Page>
	);
};

export default TasksPage;
