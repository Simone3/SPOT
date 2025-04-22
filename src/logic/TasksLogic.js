
/*
	const task = {
		id: rawTask.id,
		text: rawTask.text,
		state: rawTask.state,
		priority: rawTask.priority,
		owner: rawTask.owner,
		dueDate: rawTask.dueDate,
		tags: [ ...rawTask.tags ],
		completionDate: rawTask.completionDate,
		sortPosition: rawTask.sortPosition,
		visible: undefined
	};
*/

const matchesFilters = (task, filters) => {
	if(task.state === 'COMPLETED' && !filters.showCompleted) {
		return false;
	}

	if(filters.priorities.length > 0 && !filters.priorities.includes(task.priority)) {
		return false;
	}

	if(filters.owners.length > 0 && !filters.owners.includes(task.priority)) {
		return false;
	}

	if(filters.dueDates.length > 0 && !filters.dueDates.includes(task.priority)) {
		return false;
	}

	if(filters.tags.length > 0 && task.tags.length > 0 && task.tags.every((tag) => !filters.tags.includes(tag))) {
		return false;
	}

	if(filters.text && !new RegExp(filters.text, 'i').test(task.text)) {
		return false;
	}

	return true;
};

const addTask = (task, activeTasks, completedTasks, filters) => {
	if(task.state === 'ACTIVE') {
		activeTasks.push(task);
	}
	else {
		completedTasks.push(task);
	}
};

const activeTasksCompareFunction = (taskA, taskB) => {
	const position = taskA.sortPosition - taskB.sortPosition;
	if(position !== 0) {
		return position;
	}
	if(taskA.id < taskB.id) {
		return -1;
	}
	if(taskA.id > taskB.id) {
		return 1;
	}
	return 0;
};

const completedTasksCompareFunction = (taskA, taskB) => {
	return taskA.completionDate - taskB.completionDate;
};
