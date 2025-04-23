import { insertIntoManuallySortedList } from '../../logic/ManuallySortedList';

const logAndCheck = (list, expectedListOfIds) => {
	// console.log(`Result: ${JSON.stringify(list)}`);
	if(expectedListOfIds) {
		expect(list.map((v) => v.id)).toEqual(expectedListOfIds);
	}
	for(let i = 0; i < list.length - 1; i++) {
		expect(list[i + 1].sortPosition - list[i].sortPosition).toBeGreaterThan(0);
	}
};

test('Insert to end', () => {
	const list = [];
	insertIntoManuallySortedList(list, { id: 1 }, 0);
	insertIntoManuallySortedList(list, { id: 2 }, 1);
	insertIntoManuallySortedList(list, { id: 3 }, 2);
	insertIntoManuallySortedList(list, { id: 4 }, 3);
	logAndCheck(list, [ 1, 2, 3, 4 ]);
});

test('Insert to start', () => {
	const list = [];
	insertIntoManuallySortedList(list, { id: 1 }, 0);
	insertIntoManuallySortedList(list, { id: 2 }, 0);
	insertIntoManuallySortedList(list, { id: 3 }, 0);
	insertIntoManuallySortedList(list, { id: 4 }, 0);
	logAndCheck(list, [ 4, 3, 2, 1 ]);
});

test('Insert anywhere', () => {
	const list = [];
	insertIntoManuallySortedList(list, { id: 1 }, 0); // [ 1 ]
	insertIntoManuallySortedList(list, { id: 2 }, 0); // [ 2, 1 ]
	insertIntoManuallySortedList(list, { id: 3 }, 1); // [ 2, 3, 1 ]
	insertIntoManuallySortedList(list, { id: 4 }, 1); // [ 2, 4, 3, 1 ]
	insertIntoManuallySortedList(list, { id: 5 }, 0); // [ 5, 2, 4, 3, 1 ]
	insertIntoManuallySortedList(list, { id: 6 }, 4); // [ 5, 2, 4, 3, 6, 1 ]
	insertIntoManuallySortedList(list, { id: 7 }, 6); // [ 5, 2, 4, 3, 6, 1, 7 ]
	insertIntoManuallySortedList(list, { id: 8 }, 3); // [ 5, 2, 4, 8, 3, 6, 1, 7 ]
	insertIntoManuallySortedList(list, { id: 9 }, 5); // [ 5, 2, 4, 8, 3, 9, 6, 1, 7 ]
	logAndCheck(list, [ 5, 2, 4, 8, 3, 9, 6, 1, 7 ]);
});

test('Insert to trigger reload left', () => {
	const list = [];
	insertIntoManuallySortedList(list, { id: 1 }, 0); // [ 1 ]
	insertIntoManuallySortedList(list, { id: 2 }, 1); // [ 1, 2 ]
	insertIntoManuallySortedList(list, { id: 3 }, 2); // [ 1, 2, 3 ]
	insertIntoManuallySortedList(list, { id: 4 }, 3); // [ 1, 2, 3, 4 ]
	insertIntoManuallySortedList(list, { id: 5 }, 4); // [ 1, 2, 3, 4, 5 ]
	insertIntoManuallySortedList(list, { id: 6 }, 1); // [ 1, 6, 2, 3, 4, 5 ]
	insertIntoManuallySortedList(list, { id: 7 }, 1); // [ 1, 7, 6, 2, 3, 4, 5 ]
	insertIntoManuallySortedList(list, { id: 8 }, 1); // [ 1, 8, 7, 6, 2, 3, 4, 5 ]
	insertIntoManuallySortedList(list, { id: 9 }, 1); // [ 1, 9, 8, 7, 6, 2, 3, 4, 5 ]
	insertIntoManuallySortedList(list, { id: 10 }, 1); // [ 1, 10, 9, 8, 7, 6, 2, 3, 4, 5 ]
	insertIntoManuallySortedList(list, { id: 11 }, 1); // [ 1, 11, 10, 9, 8, 7, 6, 2, 3, 4, 5 ]
	insertIntoManuallySortedList(list, { id: 12 }, 1); // [ 1, 12, 11, 10, 9, 8, 7, 6, 2, 3, 4, 5 ]
	insertIntoManuallySortedList(list, { id: 13 }, 1); // [ 1, 13, 12, 11, 10, 9, 8, 7, 6, 2, 3, 4, 5 ]
	logAndCheck(list, [ 1, 13, 12, 11, 10, 9, 8, 7, 6, 2, 3, 4, 5 ]);
});

test('Insert to trigger reload right', () => {
	const list = [];
	insertIntoManuallySortedList(list, { id: 1 }, 0); // [ 1 ]
	insertIntoManuallySortedList(list, { id: 2 }, 1); // [ 1, 2 ]
	insertIntoManuallySortedList(list, { id: 3 }, 2); // [ 1, 2, 3 ]
	insertIntoManuallySortedList(list, { id: 4 }, 3); // [ 1, 2, 3, 4 ]
	insertIntoManuallySortedList(list, { id: 5 }, 4); // [ 1, 2, 3, 4, 5 ]
	insertIntoManuallySortedList(list, { id: 6 }, 3); // [ 1, 2, 3, 6, 4, 5 ]
	insertIntoManuallySortedList(list, { id: 7 }, 4); // [ 1, 2, 3, 6, 7, 4, 5 ]
	insertIntoManuallySortedList(list, { id: 8 }, 5); // [ 1, 2, 3, 6, 7, 8, 4, 5 ]
	insertIntoManuallySortedList(list, { id: 9 }, 6); // [ 1, 2, 3, 6, 7, 8, 9, 4, 5 ]
	insertIntoManuallySortedList(list, { id: 10 }, 7); // [ 1, 2, 3, 6, 7, 8, 9, 10, 4, 5 ]
	insertIntoManuallySortedList(list, { id: 11 }, 8); // [ 1, 2, 3, 6, 7, 8, 9, 10, 11, 4, 5 ]
	insertIntoManuallySortedList(list, { id: 12 }, 9); // [ 1, 2, 3, 6, 7, 8, 9, 10, 11, 12, 4, 5 ]
	insertIntoManuallySortedList(list, { id: 13 }, 10); // [ 1, 2, 3, 6, 7, 8, 9, 10, 11, 12, 13, 4, 5 ]
	logAndCheck(list, [ 1, 2, 3, 6, 7, 8, 9, 10, 11, 12, 13, 4, 5 ]);
});

test('Massive random inserts', () => {
	const list = [];
	for(let id = 0; id < 10000; id++) {
		insertIntoManuallySortedList(list, { id: id }, Math.floor(Math.random() * (list.length + 1)));
	}
	expect(list.length).toEqual(10000);
	logAndCheck(list, undefined);
});
