import type { ReactElement } from 'react';
import { MDXEditor } from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css';
import 'src/components/inputs/TextArea.css';

type TextAreaProps = {
	placeholder?: string;
	value: string;
	onChange: (value: string) => void;
	onBlur: () => void;
	disabled?: boolean;
};

const TextArea = ({ placeholder, value, onChange, onBlur, disabled }: TextAreaProps): ReactElement => {
	return (
		<div className={`textarea-container`}>
			<MDXEditor
				contentEditableClassName='textarea-input'
				placeholder={placeholder}
				markdown={value}
				onChange={onChange}
				onBlur={onBlur}
				plugins={[]}
				spellCheck={false}
				readOnly={disabled}
			/>
		</div>
	);
};

export { TextArea };
