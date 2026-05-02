const SORT_POSITION_STEP = 1000;

export interface ManuallySortedItem {
	sortPosition?: number;
}

/**
 * Computes sortPosition fields for elements starting from unsortedStartIndex until a suitable sortPosition is found or the end of the list is reached.
 * I.e. fixes an "unsorted section" in the list until it is closed.
 * referenceSortPosition is the element BEFORE the "unsorted section" (i.e. the reference sortPosition for the min value).
 * unsortedStartIndex is the element that starts the "unsorted section".
 * The function finds the element at index X >= unsortedStartIndex + 1 that has a sortPosition bigger than referenceSortPosition and is able to fit all
 * elements between them.
 */
const fixSortPositionsInUnsortedSection = <TElement extends ManuallySortedItem>(list: TElement[], referenceSortPosition: number, unsortedStartIndex: number): number => {
	let i = unsortedStartIndex + 1;
	let unsortedCount = 1;
	while(i < list.length) {
		if(list[i].sortPosition! - referenceSortPosition - 1 >= unsortedCount) {
			// We found an element high enough to close the "unsorted section"
			// Recompute sort positions for all elements in between with proportionally distributed sortPosition between referenceSortPosition and the found sortPosition
			const sortFixStep = (list[i].sortPosition! - referenceSortPosition - 1) / (unsortedCount + 1);
			for(let j = 0; j < unsortedCount; j++) {
				list[unsortedStartIndex + j].sortPosition = referenceSortPosition + Math.ceil((j + 1) * sortFixStep);
			}
			return i + 1;
		}
		else {
			// The current element does not allow to close the "unsorted section": count and go on
			unsortedCount += 1;
			i += 1;
		}
	}

	// We reached the end of the list without closing the "unsorted section": reload all trailing elements with the default step
	for(let j = unsortedStartIndex; j < list.length; j++) {
		list[j].sortPosition = list[j - 1].sortPosition! + SORT_POSITION_STEP;
	}
	return i;
};

/**
 * Inserts an item at position "index" (shifting all following elements, the current "index" element included).
 * It also sets the "sortPosition" field in the new element.
 * It may recompute the "sortPosition" fields of other elements if space needs to be made.
 */
export const insertIntoManuallySortedList = <TElement extends ManuallySortedItem>(list: TElement[], element: TElement, index: number): TElement[] => {
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
		element.sortPosition = list[0].sortPosition! - SORT_POSITION_STEP;
		list.unshift(element);
		return list;
	}

	// Add at the end of the list: position is the current last element plus the step
	if(index >= list.length) {
		element.sortPosition = list[list.length - 1].sortPosition! + SORT_POSITION_STEP;
		list.push(element);
		return list;
	}

	// Add in the middle of the list and then compute sortPosition to fit adjacent elements (possibly changing sortPosition of following elements if there's no space to fit the new one)
	list.splice(index, 0, element);
	fixSortPositionsInUnsortedSection(list, list[index - 1].sortPosition!, index);
	return list;
};

/**
 * Moves the item at position "fromIndex" to position "toIndex" (i.e. it will be placed in the position BEFORE the current "toIndex" element).
 * It also updates the "sortPosition" field in the moved element.
 * It may recompute the "sortPosition" fields of other elements if space needs to be made.
 */
export const moveInManuallySortedList = <TElement extends ManuallySortedItem>(list: TElement[], fromIndex: number, toIndex: number): TElement[] => {
	if(!Array.isArray(list)) {
		throw Error('List is not an array');
	}

	if(fromIndex < 0 || fromIndex >= list.length) {
		throw Error('FromIndex out of bound');
	}

	if(fromIndex === toIndex) {
		return list;
	}

	// Remove element from toIndex, clone it and re-add it to toIndex (this can probably be implemented more efficiently but enough for now...)
	const [ element ] = list.splice(fromIndex, 1);
	insertIntoManuallySortedList(list, element, toIndex);
	return list;
};

/**
 * Given a SORTED list, recomputes the "sortPosition" fields whenever necessary (i.e. where tasks are out of order with non-ascending "sortPosition" fields)
 */
export const recomputeSortPositions = <TElement extends ManuallySortedItem>(list: TElement[]): TElement[] => {
	if(list.length <= 1) {
		return list;
	}

	let i = 1;
	while(i < list.length) {
		if(list[i - 1].sortPosition! >= list[i].sortPosition!) {
			// Current element is unsorted, call the utility to close this "unsorted section" (possibly spanning more than one element)
			i = fixSortPositionsInUnsortedSection(list, list[i - 1].sortPosition!, i);
		}
		else {
			// All good with current sorting, move on
			i += 1;
		}
	}

	return list;
};
