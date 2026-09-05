import type { ReactElement } from 'react';
import 'src/components/inputs/TextArea.css';

type TextAreaProps = {
	placeholder?: string;
	value: string;
	onChange: (value: string) => void;
	onBlur: () => void;
	disabled?: boolean;
};

// A task's text is plain text held in a plain textarea, which is what lets it hold whatever the user typed, blank lines
// included. A rich text editor over Markdown was here before and could not: Markdown has no way to write two blank lines
// in a row, so every reload of a value collapsed them back into one paragraph break.
const TextArea = ({ placeholder, value, onChange, onBlur, disabled }: TextAreaProps): ReactElement => {
	return (
		<div className='textarea-container'>
			<textarea
				className='textarea-input'
				placeholder={placeholder}
				value={value}
				disabled={disabled}
				spellCheck={false}

				// The field is one line tall until CSS grows it to what it holds, so a task with no text takes the room of one
				rows={1}
				onChange={(event) => {
					return onChange(event.target.value);
				}}
				onBlur={onBlur}
			/>
		</div>
	);
};

export { TextArea };
