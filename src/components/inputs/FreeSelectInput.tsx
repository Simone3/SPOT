import 'src/components/inputs/FreeSelectInput.css';
import { useState, useId, useRef, useEffect, type FocusEvent, type ReactElement, type ReactNode } from 'react';

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
 * An option to show in the dropdown, with the position of the typed text inside its label (-1 when nothing was typed).
 */
type MatchedOption = {
	option: FreeSelectOption;
	matchIndex: number;
};

/**
 * Returns the options to show in the dropdown, each with the position of the typed text inside its label.
 * @param options All available options.
 * @param filterValue Text the user typed, or an empty string to show every option.
 * @returns The matching options, in the order they were given.
 */
const getMatchedOptions = (options: FreeSelectOption[], filterValue: string): MatchedOption[] => {
	if(!filterValue) {
		return options.map((option) => {
			return { option, matchIndex: -1 };
		});
	}

	const lowerCaseFilterValue = filterValue.toLowerCase();
	const matchedOptions: MatchedOption[] = [];
	for(const option of options) {
		// Match case-insensitive substrings but not exactly the same string (case-sensitive)
		const matchIndex = option.label.toLowerCase().indexOf(lowerCaseFilterValue);
		if(matchIndex !== -1 && option.label !== filterValue) {
			matchedOptions.push({ option, matchIndex });
		}
	}
	return matchedOptions;
};

/**
 * Renders an option label with the part the user did not type in bold, so that what picking the option would add stands out.
 * @param label Option label.
 * @param matchIndex Position of the typed text inside the label, or -1 when nothing was typed.
 * @param matchLength Length of the typed text.
 * @returns The option label content.
 */
const renderOptionLabel = (label: string, matchIndex: number, matchLength: number): ReactNode => {
	if(matchIndex === -1) {
		return label;
	}

	const beforeMatch = label.slice(0, matchIndex);
	const match = label.slice(matchIndex, matchIndex + matchLength);
	const afterMatch = label.slice(matchIndex + matchLength);
	return (
		<>
			{beforeMatch && <span className='free-select-input-option-completion'>{beforeMatch}</span>}
			{match}
			{afterMatch && <span className='free-select-input-option-completion'>{afterMatch}</span>}
		</>
	);
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
	const filterValue = changedAfterOpen ? value : '';

	// The options exist only while the dropdown is open: a closed dropdown then costs nothing at all, which matters
	// because a task list renders one of these inputs per owner and per tag of every visible task
	const matchedOptions = open ? getMatchedOptions(options, filterValue) : [];

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
					value={value}
					onChange={(e) => {
						onChange(e.target.value);
						doSetChanged();
					}}
					onFocus={doOpen}
					onBlur={onBlur}
				/>
			</div>
			{matchedOptions.length > 0 && (
				<div className='free-select-input-dropdown-container'>
					<div className='free-select-input-options-container'>
						<ul className='free-select-input-options'>
							{matchedOptions.map(({ option, matchIndex }) => {
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
										{renderOptionLabel(option.label, matchIndex, filterValue.length)}
									</li>
								);
							})}
						</ul>
					</div>
				</div>
			)}
		</div>
	);
};

export { FreeSelectInput };
