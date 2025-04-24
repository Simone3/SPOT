const SORT_POSITION_STEP = 100;

/**
 * Inserts an item at position "index" (shifting all following elements, the current "index" element included).
 * It also sets the "sortPosition" field in the new element.
 * It may recompute the "sortPosition" fields of other elements if space needs to be made.
 */
export const insertIntoManuallySortedList = (list, element, index) => {
	if(!Array.isArray(list)) {
		throw Error('List is not an array');
	}

	// Empty list: start with position 0
	if(list.length === 0) {
		element.sortPosition = 0;
		list.push(element);
		return list;
	}

	// Add at the start of the list: position is the current first element minus the step
	if(index <= 0) {
		element.sortPosition = list[0].sortPosition - SORT_POSITION_STEP;
		list.unshift(element);
		return list;
	}

	// Add at the end of the list: position is the current last element plus the step
	if(index >= list.length) {
		element.sortPosition = list[list.length - 1].sortPosition + SORT_POSITION_STEP;
		list.push(element);
		return list;
	}

	// Add in the middle of the list and there's space for the new element: position is the mid point between the previous and next elements
	const prevSortPosition = list[index - 1].sortPosition;
	const nextSortPosition = list[index].sortPosition;
	if(nextSortPosition - prevSortPosition > 1) {
		element.sortPosition = prevSortPosition + Math.round((nextSortPosition - prevSortPosition) / 2);
		list.splice(index, 0, element);
		return list;
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
	return list;
};

/**
 * Moves the item at position "fromIndex" to position "toIndex" (i.e. it will be placed in the position BEFORE the current "toIndex" element).
 * It also updates the "sortPosition" field in the moved element.
 * It may recompute the "sortPosition" fields of other elements if space needs to be made.
 */
export const moveInManuallySortedList = (list, fromIndex, toIndex) => {
	if(!Array.isArray(list)) {
		throw Error('List is not an array');
	}

	if(fromIndex < 0 || fromIndex >= list.length) {
		throw Error('Index out of bound');
	}

	if(fromIndex === toIndex || fromIndex === toIndex - 1) {
		return list;
	}

	// Remove element from toIndex, clone it and re-add it to toIndex (this can probably be implemented more efficiently but enough for now...)
	const element = { ...list.splice(fromIndex, 1)[0] };
	insertIntoManuallySortedList(list, element, fromIndex < toIndex ? toIndex - 1 : toIndex);
	return list;
};
