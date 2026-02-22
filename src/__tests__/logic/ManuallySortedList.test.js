import { insertIntoManuallySortedList, moveInManuallySortedList, recomputeSortPositions } from '../../logic/ManuallySortedList';

const randomIndex = (length) => {
	return Math.floor(Math.random() * (length + 1));
};

const shuffle = (array) => {
	for(let i = array.length - 1; i >= 1; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[ array[i], array[j] ] = [ array[j], array[i] ];
	}
	return array;
};

const check = (list, expectedListOfIds) => {
	if(expectedListOfIds) {
		expect(list.map((v) => v.id)).toEqual(expectedListOfIds);
	}
	for(let i = 0; i < list.length - 1; i++) {
		expect(list[i + 1].sortPosition - list[i].sortPosition).toBeGreaterThan(0);
	}
};

test('Insert to end', () => {
	const list = [];
	check(insertIntoManuallySortedList(list, { id: 1 }, 0), [ 1 ]);
	check(insertIntoManuallySortedList(list, { id: 2 }, 1), [ 1, 2 ]);
	check(insertIntoManuallySortedList(list, { id: 3 }, 2), [ 1, 2, 3 ]);
	check(insertIntoManuallySortedList(list, { id: 4 }, 3), [ 1, 2, 3, 4 ]);
});

test('Insert to start', () => {
	const list = [];
	check(insertIntoManuallySortedList(list, { id: 1 }, 0), [ 1 ]);
	check(insertIntoManuallySortedList(list, { id: 2 }, 0), [ 2, 1 ]);
	check(insertIntoManuallySortedList(list, { id: 3 }, 0), [ 3, 2, 1 ]);
	check(insertIntoManuallySortedList(list, { id: 4 }, 0), [ 4, 3, 2, 1 ]);
});

test('Insert anywhere', () => {
	const list = [];
	check(insertIntoManuallySortedList(list, { id: 1 }, 0), [ 1 ]);
	check(insertIntoManuallySortedList(list, { id: 2 }, 0), [ 2, 1 ]);
	check(insertIntoManuallySortedList(list, { id: 3 }, 1), [ 2, 3, 1 ]);
	check(insertIntoManuallySortedList(list, { id: 4 }, 1), [ 2, 4, 3, 1 ]);
	check(insertIntoManuallySortedList(list, { id: 5 }, 0), [ 5, 2, 4, 3, 1 ]);
	check(insertIntoManuallySortedList(list, { id: 6 }, 4), [ 5, 2, 4, 3, 6, 1 ]);
	check(insertIntoManuallySortedList(list, { id: 7 }, 6), [ 5, 2, 4, 3, 6, 1, 7 ]);
	check(insertIntoManuallySortedList(list, { id: 8 }, 3), [ 5, 2, 4, 8, 3, 6, 1, 7 ]);
	check(insertIntoManuallySortedList(list, { id: 9 }, 5), [ 5, 2, 4, 8, 3, 9, 6, 1, 7 ]);
});

test('Insert to trigger reload left', () => {
	const list = [];
	check(insertIntoManuallySortedList(list, { id: 1 }, 0), [ 1 ]);
	check(insertIntoManuallySortedList(list, { id: 2 }, 1), [ 1, 2 ]);
	check(insertIntoManuallySortedList(list, { id: 3 }, 2), [ 1, 2, 3 ]);
	check(insertIntoManuallySortedList(list, { id: 4 }, 3), [ 1, 2, 3, 4 ]);
	check(insertIntoManuallySortedList(list, { id: 5 }, 4), [ 1, 2, 3, 4, 5 ]);
	check(insertIntoManuallySortedList(list, { id: 6 }, 1), [ 1, 6, 2, 3, 4, 5 ]);
	check(insertIntoManuallySortedList(list, { id: 7 }, 1), [ 1, 7, 6, 2, 3, 4, 5 ]);
	check(insertIntoManuallySortedList(list, { id: 8 }, 1), [ 1, 8, 7, 6, 2, 3, 4, 5 ]);
	check(insertIntoManuallySortedList(list, { id: 9 }, 1), [ 1, 9, 8, 7, 6, 2, 3, 4, 5 ]);
	check(insertIntoManuallySortedList(list, { id: 10 }, 1), [ 1, 10, 9, 8, 7, 6, 2, 3, 4, 5 ]);
	check(insertIntoManuallySortedList(list, { id: 11 }, 1), [ 1, 11, 10, 9, 8, 7, 6, 2, 3, 4, 5 ]);
	check(insertIntoManuallySortedList(list, { id: 12 }, 1), [ 1, 12, 11, 10, 9, 8, 7, 6, 2, 3, 4, 5 ]);
	check(insertIntoManuallySortedList(list, { id: 13 }, 1), [ 1, 13, 12, 11, 10, 9, 8, 7, 6, 2, 3, 4, 5 ]);
});

test('Insert to trigger reload right', () => {
	const list = [];
	check(insertIntoManuallySortedList(list, { id: 1 }, 0), [ 1 ]);
	check(insertIntoManuallySortedList(list, { id: 2 }, 1), [ 1, 2 ]);
	check(insertIntoManuallySortedList(list, { id: 3 }, 2), [ 1, 2, 3 ]);
	check(insertIntoManuallySortedList(list, { id: 4 }, 3), [ 1, 2, 3, 4 ]);
	check(insertIntoManuallySortedList(list, { id: 5 }, 4), [ 1, 2, 3, 4, 5 ]);
	check(insertIntoManuallySortedList(list, { id: 6 }, 3), [ 1, 2, 3, 6, 4, 5 ]);
	check(insertIntoManuallySortedList(list, { id: 7 }, 4), [ 1, 2, 3, 6, 7, 4, 5 ]);
	check(insertIntoManuallySortedList(list, { id: 8 }, 5), [ 1, 2, 3, 6, 7, 8, 4, 5 ]);
	check(insertIntoManuallySortedList(list, { id: 9 }, 6), [ 1, 2, 3, 6, 7, 8, 9, 4, 5 ]);
	check(insertIntoManuallySortedList(list, { id: 10 }, 7), [ 1, 2, 3, 6, 7, 8, 9, 10, 4, 5 ]);
	check(insertIntoManuallySortedList(list, { id: 11 }, 8), [ 1, 2, 3, 6, 7, 8, 9, 10, 11, 4, 5 ]);
	check(insertIntoManuallySortedList(list, { id: 12 }, 9), [ 1, 2, 3, 6, 7, 8, 9, 10, 11, 12, 4, 5 ]);
	check(insertIntoManuallySortedList(list, { id: 13 }, 10), [ 1, 2, 3, 6, 7, 8, 9, 10, 11, 12, 13, 4, 5 ]);
});

test('Insert with multiple reloads', () => {
	const list = [
		{ id: 0, sortPosition: -100 },
		{ id: 1, sortPosition: 0 },
		{ id: 2, sortPosition: 100 },
		{ id: 3, sortPosition: 101 },
		{ id: 4, sortPosition: 102 },
		{ id: 5, sortPosition: 103 },
		{ id: 6, sortPosition: 104 },
		{ id: 7, sortPosition: 106 },
		{ id: 8, sortPosition: 200 },
		{ id: 9, sortPosition: 300 },
		{ id: 10, sortPosition: 400 }
	];

	check(insertIntoManuallySortedList(list, { id: 11 }, 3));
});

test('Insert without space left until the end', () => {
	const list = [
		{ id: 0, sortPosition: -100 },
		{ id: 1, sortPosition: 0 },
		{ id: 2, sortPosition: 7 },
		{ id: 3, sortPosition: 15 },
		{ id: 4, sortPosition: 38 },
		{ id: 5, sortPosition: 62 },
		{ id: 6, sortPosition: 125 },
		{ id: 7, sortPosition: 128 },
		{ id: 8, sortPosition: 129 },
		{ id: 9, sortPosition: 130 },
		{ id: 10, sortPosition: 131 }
	];

	check(insertIntoManuallySortedList(list, { id: 11 }, 8));
});

test('Move items around', () => {
	const list = [
		{ id: 0, sortPosition: -500 },
		{ id: 1, sortPosition: -400 },
		{ id: 2, sortPosition: -300 },
		{ id: 3, sortPosition: -200 },
		{ id: 4, sortPosition: -100 },
		{ id: 5, sortPosition: 0 },
		{ id: 6, sortPosition: 100 },
		{ id: 7, sortPosition: 200 },
		{ id: 8, sortPosition: 300 },
		{ id: 9, sortPosition: 400 },
		{ id: 10, sortPosition: 500 }
	];
	check(moveInManuallySortedList(list, 7, 2), [ 0, 1, 7, 2, 3, 4, 5, 6, 8, 9, 10 ]);
	check(moveInManuallySortedList(list, 1, 8), [ 0, 7, 2, 3, 4, 5, 6, 8, 1, 9, 10 ]);
	check(moveInManuallySortedList(list, 4, 4), [ 0, 7, 2, 3, 4, 5, 6, 8, 1, 9, 10 ]);
	check(moveInManuallySortedList(list, 4, 5), [ 0, 7, 2, 3, 5, 4, 6, 8, 1, 9, 10 ]);
	check(moveInManuallySortedList(list, 4, 6), [ 0, 7, 2, 3, 4, 6, 5, 8, 1, 9, 10 ]);
	check(moveInManuallySortedList(list, 6, 5), [ 0, 7, 2, 3, 4, 5, 6, 8, 1, 9, 10 ]);
	check(moveInManuallySortedList(list, 3, 0), [ 3, 0, 7, 2, 4, 5, 6, 8, 1, 9, 10 ]);
	check(moveInManuallySortedList(list, 3, 10), [ 3, 0, 7, 4, 5, 6, 8, 1, 9, 10, 2 ]);
	check(moveInManuallySortedList(list, 3, 11), [ 3, 0, 7, 5, 6, 8, 1, 9, 10, 2, 4 ]);
	check(moveInManuallySortedList(list, 7, 1), [ 3, 9, 0, 7, 5, 6, 8, 1, 10, 2, 4 ]);
	check(moveInManuallySortedList(list, 0, 11), [ 9, 0, 7, 5, 6, 8, 1, 10, 2, 4, 3 ]);
	check(moveInManuallySortedList(list, 10, 0), [ 3, 9, 0, 7, 5, 6, 8, 1, 10, 2, 4 ]);
});

test('Move with recompute', () => {
	const list = [
		{ id: 0, sortPosition: -500 },
		{ id: 1, sortPosition: -400 },
		{ id: 2, sortPosition: -300 },
		{ id: 3, sortPosition: -200 },
		{ id: 4, sortPosition: -100 },
		{ id: 5, sortPosition: 0 },
		{ id: 6, sortPosition: 100 },
		{ id: 7, sortPosition: 200 },
		{ id: 8, sortPosition: 300 },
		{ id: 9, sortPosition: 400 },
		{ id: 10, sortPosition: 500 }
	];

	check(moveInManuallySortedList(list, 10, 5), [ 0, 1, 2, 3, 4, 10, 5, 6, 7, 8, 9 ]);
	check(moveInManuallySortedList(list, 10, 0), [ 9, 0, 1, 2, 3, 4, 10, 5, 6, 7, 8 ]);
	check(moveInManuallySortedList(list, 1, 11), [ 9, 1, 2, 3, 4, 10, 5, 6, 7, 8, 0 ]);
	check(moveInManuallySortedList(list, 10, 7), [ 9, 1, 2, 3, 4, 10, 5, 0, 6, 7, 8 ]);
});

test('Recompute positions simple smaller', () => {
	const list = [
		{ id: 0, sortPosition: -500 },
		{ id: 1, sortPosition: -400 },
		{ id: 2, sortPosition: -300 },
		{ id: 3, sortPosition: -200 },
		{ id: 4, sortPosition: -100 },
		{ id: 5, sortPosition: 0 },
		{ id: 6, sortPosition: 100 },
		{ id: 7, sortPosition: 10 },
		{ id: 8, sortPosition: 300 },
		{ id: 9, sortPosition: 400 },
		{ id: 10, sortPosition: 500 }
	];
	check(recomputeSortPositions(list), [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 ]);
});

test('Recompute positions simple bigger', () => {
	const list = [
		{ id: 0, sortPosition: -500 },
		{ id: 1, sortPosition: -400 },
		{ id: 2, sortPosition: -300 },
		{ id: 3, sortPosition: -200 },
		{ id: 4, sortPosition: -100 },
		{ id: 5, sortPosition: 0 },
		{ id: 6, sortPosition: 100 },
		{ id: 7, sortPosition: 600 },
		{ id: 8, sortPosition: 300 },
		{ id: 9, sortPosition: 400 },
		{ id: 10, sortPosition: 500 }
	];
	check(recomputeSortPositions(list), [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 ]);
});

test('Recompute positions multiple', () => {
	const list = [
		{ id: 0, sortPosition: -500 },
		{ id: 1, sortPosition: -400 },
		{ id: 2, sortPosition: -300 },
		{ id: 3, sortPosition: -200 },
		{ id: 4, sortPosition: -100 },
		{ id: 5, sortPosition: 3 },
		{ id: 6, sortPosition: 2 },
		{ id: 7, sortPosition: 1 },
		{ id: 8, sortPosition: 0 },
		{ id: 9, sortPosition: 7 },
		{ id: 10, sortPosition: 500 }
	];
	check(recomputeSortPositions(list), [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 ]);
});

test('Recompute positions inverted', () => {
	const list = [
		{ id: 0, sortPosition: 500 },
		{ id: 1, sortPosition: 400 },
		{ id: 2, sortPosition: 300 },
		{ id: 3, sortPosition: 200 },
		{ id: 4, sortPosition: 100 },
		{ id: 5, sortPosition: 0 },
		{ id: 6, sortPosition: -100 },
		{ id: 7, sortPosition: -200 },
		{ id: 8, sortPosition: -300 },
		{ id: 9, sortPosition: -400 },
		{ id: 10, sortPosition: -500 }
	];
	check(recomputeSortPositions(list), [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 ]);
});

test('Random operations with check at every step', () => {
	const list = [];
	for(let id = 0; id < 100; id++) {
		check(insertIntoManuallySortedList(list, { id: id }, randomIndex(list.length)));
		for(let _ = 0; _ < 3; _++) {
			check(moveInManuallySortedList(list, randomIndex(list.length - 1), randomIndex(list.length)));
		}
	}

	expect(list.length).toEqual(100);

	for(let _ = 0; _ < 3; _++) {
		check(recomputeSortPositions(shuffle(list)));
	}
	
	expect(list.length).toEqual(100);
});

test('Massive random inserts and moves', () => {
	const list = [];
	for(let id = 0; id < 10000; id++) {
		insertIntoManuallySortedList(list, { id: id }, randomIndex(list.length));
		for(let _ = 0; _ < 10; _++) {
			moveInManuallySortedList(list, randomIndex(list.length - 1), randomIndex(list.length));
		}
	}

	expect(list.length).toEqual(10000);
	check(list);

	for(let _ = 0; _ < 10; _++) {
		recomputeSortPositions(shuffle(list));
	}

	expect(list.length).toEqual(10000);
	check(list);
});
