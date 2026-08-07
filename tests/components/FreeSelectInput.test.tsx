import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { FreeSelectInput } from 'src/components/inputs/FreeSelectInput';

const options = [
	{ key: 'empty', value: '', label: 'Me' },
	{ key: 'alice', value: 'Alice', label: 'Alice' },
	{ key: 'malice', value: 'Malice', label: 'Malice' },
	{ key: 'bob', value: 'Bob', label: 'Bob' }
];

// The component is controlled, so what the user types only comes back to it if something holds it
const ControlledFreeSelectInput = () => {
	const [ value, setValue ] = useState('');

	return (
		<FreeSelectInput
			label='Owner'
			value={value}
			options={options}
			onChange={setValue}
		/>
	);
};

const optionLabels = () => {
	return screen.queryAllByRole('listitem').map((option) => {
		return option.textContent;
	});
};

const boldedParts = (option: HTMLElement) => {
	return Array.from(option.querySelectorAll('.free-select-input-option-completion')).map((part) => {
		return part.textContent;
	});
};

describe('FreeSelectInput', () => {
	test('renders the options only while the dropdown is open', () => {
		render(<ControlledFreeSelectInput/>);
		const input = screen.getByLabelText('Owner');

		expect(optionLabels()).toEqual([]);

		fireEvent.focus(input);

		expect(optionLabels()).toEqual([ 'Me', 'Alice', 'Malice', 'Bob' ]);

		fireEvent.blur(input);

		expect(optionLabels()).toEqual([]);
	});

	test('bolds the part of a matching option the user has not typed', () => {
		render(<ControlledFreeSelectInput/>);
		const input = screen.getByLabelText('Owner');

		fireEvent.focus(input);
		fireEvent.change(input, { target: { value: 'ali' } });

		// The match is a case-insensitive substring, so it can start anywhere in the label
		expect(optionLabels()).toEqual([ 'Alice', 'Malice' ]);

		const [ alice, malice ] = screen.getAllByRole('listitem');
		expect(boldedParts(alice)).toEqual([ 'ce' ]);
		expect(boldedParts(malice)).toEqual([ 'M', 'ce' ]);
	});
});
