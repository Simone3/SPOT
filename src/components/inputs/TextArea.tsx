import { useEffect, useRef, type ReactElement } from 'react';
import { MDXEditor, type MDXEditorMethods } from '@mdxeditor/editor';
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
	const editorRef = useRef<MDXEditorMethods>(null);

	// MDXEditor reads "markdown" only when it mounts, so a value replaced from the outside (e.g. tasks reloaded from the
	// database after a failed write) has to be pushed into it, or the editor would keep showing content nobody stored.
	// The comparison keeps the editor untouched while the user types, because then it already holds the incoming value.
	useEffect(() => {
		if(editorRef.current && editorRef.current.getMarkdown() !== value) {
			editorRef.current.setMarkdown(value);
		}
	}, [ value ]);

	return (
		<div className={`textarea-container`}>
			<MDXEditor
				ref={editorRef}
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
