import 'src/components/inputs/FreeSelectInput.css';
import { useState, useId, useRef, useEffect, type FocusEvent, type ReactElement } from 'react';

type FreeSelectOption = {
	key: string;
	value: string;
	label: string;
};

type FreeSelectInputProps = {
	id?: string;
	label?: string;
	placeholder?: string;
	options: FreeSelectOption[];
	disabled?: boolean;
	value: string;
	onChange: (value: string) => void;
	onFinishEditing?: (value: string) => void;
};

/**
 * A dropdown input that also allows free typing (or in other words: a text input with suggestions)
 * @param props Free-select input settings and callbacks.
 * @returns The editable select input.
 */
const FreeSelectInput = (props: FreeSelectInputProps): ReactElement => {
	const { id: idFromProps, label, placeholder, options, disabled, value, onChange, onFinishEditing } = props;

	// The caller can own the input id, so that something outside this component (a chip icon, for one) can label the input
	const generatedId = useId();
	const id = idFromProps || generatedId;

	const [ open, setOpen ] = useState(false);
	const [ changedAfterOpen, setChangedAfterOpen ] = useState(false);

	const containerRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if(disabled) {
			setOpen(false);
			setChangedAfterOpen(false);
		}
	}, [ disabled ]);

	const doOpen = (): void => {
		if(!disabled && !open) {
			setOpen(true);
		}
	};

	const doClose = (currentValue?: string): void => {
		if(open) {
			setOpen(false);
			setChangedAfterOpen(false);
			if(onFinishEditing) {
				onFinishEditing(currentValue || inputRef.current!.value);
			}
		}
	};

	const doSetChanged = (): void => {
		if(open && !changedAfterOpen) {
			setChangedAfterOpen(true);
		}
	};

	// Filter dropdown options, but only after the user typed something in the free text input
	const currentStringValue = value;

	const filteredOptions = changedAfterOpen && currentStringValue ?
		options.filter((option) => {
			// Match case-insensitive substrings but not exactly the same string (case-sensitive)
			return option.label.toLowerCase().indexOf(currentStringValue.toLowerCase()) !== -1 && option.label !== currentStringValue;
		}) :
		options;

	const onBlur = (e: FocusEvent<HTMLElement>): void => {
		if(!containerRef.current!.contains(e.relatedTarget)) {
			doClose();
		}
	};

	return (
		<div className='free-select-input' ref={containerRef}>
			{label && <label htmlFor={id} className='free-select-label'>{label}</label>}
			<div className='free-select-input-fixed-container'>
				<input
					id={id}
					ref={inputRef}
					className='free-select-input-value'
					disabled={disabled}
					type='text'
					autoCorrect='off'
					autoCapitalize='none'
					spellCheck='false'
					autoComplete='off'
					placeholder={placeholder}
					value={currentStringValue}
					onChange={(e) => {
						onChange(e.target.value);
						doSetChanged();
					}}
					onFocus={doOpen}
					onBlur={onBlur}
				/>
			</div>
			<div className={`free-select-input-dropdown-container free-select-input-dropdown-container-${open && filteredOptions.length > 0 ? 'open' : 'closed'}`}>
				<div className='free-select-input-options-container'>
					<ul className='free-select-input-options'>
						{filteredOptions.map((option) => {
							return (
								<li
									key={option.key}
									className='free-select-input-option'
									tabIndex={0}
									onBlur={onBlur}
									onClick={() => {
										onChange(option.value);
										doClose(option.value);
									}}>
									{option.label}
								</li>
							);
						})}
					</ul>
				</div>
			</div>
		</div>
	);
};

export { FreeSelectInput };
