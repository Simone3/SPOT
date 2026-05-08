import type { ReactElement } from 'react';
import { MDXEditor } from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css';
import './TextArea.css';

type TextAreaProps = {
	placeholder?: string;
	value: string;
	onChange: (value: string) => void;
	onBlur: () => void;
};

const TextArea = ({ placeholder, value, onChange, onBlur }: TextAreaProps): ReactElement => {
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
			/>
		</div>
	);
};

export default TextArea;
