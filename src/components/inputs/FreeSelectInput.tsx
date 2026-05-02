import './FreeSelectInput.css';
import { useState, useId, useRef, type FocusEvent } from 'react';
import type { DomainEntry, TaskDomainValue } from '../../types';

/**
 * A dropdown input that also allows free typing (or in other words: a text input with suggestions)
 */
type FreeSelectInputProps<TValue extends TaskDomainValue> = {
	label?: string;
	placeholder?: string;
	options: DomainEntry<TValue>[];
	disabled?: boolean;
	value: TValue;
	onChange: (value: TValue | string) => void;
	onFinishEditing?: (value: TValue | string | undefined) => void;
};

const FreeSelectInput = <TValue extends TaskDomainValue, >({ label, placeholder, options, disabled, value, onChange, onFinishEditing }: FreeSelectInputProps<TValue>) => {
	const id = useId();

	const [ open, setOpen ] = useState(false);
	const [ changedAfterOpen, setChangedAfterOpen ] = useState(false);

	const containerRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	const doOpen = () => {
		if(!open) {
			setOpen(true);
		}
	};

	const doClose = (currentValue?: TValue | string) => {
		if(open) {
			setOpen(false);
			setChangedAfterOpen(false);
			if(onFinishEditing) {
				onFinishEditing(currentValue || inputRef.current!.value);
			}
		}
	};

	const doSetChanged = () => {
		if(open && !changedAfterOpen) {
			setChangedAfterOpen(true);
		}
	};

	// Filter dropdown options, but only after the user typed something in the free text input
	const filteredOptions = changedAfterOpen && value ?
		options.filter((option) => {
			// Match case-insensitive substrings but not exactly the same string (case-sensitive)
			return option.label.toLowerCase().indexOf(value.toLowerCase()) !== -1 && option.label !== value;
		}) :
		options;

	const onBlur = (e: FocusEvent<HTMLElement>) => {
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
					value={value || ''}
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

export default FreeSelectInput;
