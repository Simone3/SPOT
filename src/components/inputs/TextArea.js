import { useId } from 'react';
import { MDXEditor } from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css';
import './TextArea.css';

const TextArea = ({ placeholder, value, onChange, onBlur }) => {
	const id = useId();
	return (
		<div className={`textarea-container`}>
			<MDXEditor
				id={id}
				contentEditableClassName='textarea-input'
				placeholder={placeholder}
				markdown={value}
				onChange={onChange}
				onBlur={onBlur}
				plugins={[]}
			/>
		</div>
	);
};

export default TextArea;
