import { useId } from 'react';
import { MDXEditor } from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css';
import './TextArea.css';

const UntypedMDXEditor = MDXEditor as any;

type TextAreaProps = {
	placeholder?: string;
	value: string;
	onChange: (value: string) => void;
	onBlur: () => void;
};

const TextArea = ({ placeholder, value, onChange, onBlur }: TextAreaProps) => {
	const id = useId();
	return (
		<div className={`textarea-container`}>
			<UntypedMDXEditor
				id={id}
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
