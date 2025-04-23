const SORT_POSITION_STEP = 100;

export const insertIntoManuallySortedList = (list, element, index) => {
	// Empty list: start with position 0
	if(list.length === 0) {
		element.sortPosition = 0;
		list.push(element);
		return;
	}

	// Add at the start of the list: position is the current first element minus the step
	if(index <= 0) {
		element.sortPosition = list[0].sortPosition - SORT_POSITION_STEP;
		list.unshift(element);
		return;
	}

	// Add at the end of the list: position is the current last element plus the step
	if(index >= list.length) {
		element.sortPosition = list[list.length - 1].sortPosition + SORT_POSITION_STEP;
		list.push(element);
		return;
	}

	// Add in the middle of the list and there's space for the new element: position is the mid point between the previous and next elements
	const prevSortPosition = list[index - 1].sortPosition;
	const nextSortPosition = list[index].sortPosition;
	if(nextSortPosition - prevSortPosition > 1) {
		element.sortPosition = prevSortPosition + Math.round((nextSortPosition - prevSortPosition) / 2);
		list.splice(index, 0, element);
		return;
	}

	// Add in the middle of the list but there's no space for the new element: reset all positions before or after the new element (included)
	if(index > list.length - index) {
		let position = list[index - 1].sortPosition + SORT_POSITION_STEP;
		element.sortPosition = position;
		for(let j = index; j < list.length; j++) {
			position += SORT_POSITION_STEP;
			list[j].sortPosition = position;
		}
	}
	else {
		let position = list[index].sortPosition - SORT_POSITION_STEP;
		element.sortPosition = position;
		for(let j = index - 1; j >= 0; j--) {
			position -= SORT_POSITION_STEP;
			list[j].sortPosition = position;
		}
	}
	list.splice(index, 0, element);
};
