import './FreeSelectInput.css';
import React, { useState, useId, useContext, useEffect } from 'react';
import { useDetectClickOutside } from 'react-detect-click-outside';
import { ClickOutsideContext } from '../../contexts/ClickOutsideContext';

/**
 * A dropdown input that also allows free typing (or in other words: a text input with suggestions)
 */
const FreeSelectInput = ({ label, placeholder, options, disabled, value, onChange }) => {
	const id = useId();

	const [ open, setOpen ] = useState(false);
	const [ changedAfterOpen, setChangedAfterOpen ] = useState(false);

	// Update counter in the global context when this component opens/closes
	const clickOutsideOpenCounterRef = useContext(ClickOutsideContext);
	useEffect(() => {
		if(open) {
			clickOutsideOpenCounterRef.current += 1;
		}
		return () => {
			if(open) {
				clickOutsideOpenCounterRef.current -= 1;
			}
		};
	}, [ clickOutsideOpenCounterRef, open, setOpen ]);

	const doOpen = () => {
		if(!open) {
			setOpen(true);
		}
	};

	const doClose = () => {
		if(open) {
			setOpen(false);
			setChangedAfterOpen(false);
		}
	};

	const doSetChanged = () => {
		if(open && !changedAfterOpen) {
			setChangedAfterOpen(true);
		}
	};

	const ref = useDetectClickOutside({
		onTriggered: doClose
	});

	// Filter dropdown options, but only after the user typed something in the free text input
	const filteredOptions = changedAfterOpen && value ?
		options.filter((option) => {
			return option.toLowerCase().indexOf(value.toLowerCase()) !== -1;
		}) :
		options;

	return (
		<div className={`free-select-input free-select-input-${open ? 'open' : 'closed'}`} ref={ref}>
			{label && <label htmlFor={id} className='free-select-label'>{label}</label>}
			<div className='free-select-input-fixed-container'>
				<input
					id={id}
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
				/>
			</div>
			<div className='free-select-input-dropdown-container'>
				<div className='free-select-input-options-container'>
					<ul className='free-select-input-options'>
						{filteredOptions.map((option, index) => {
							return (
								<li
									key={index}
									className='free-select-input-option'
									onClick={() => {
										doClose();
										onChange(option);
									}}>
									{option}
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

