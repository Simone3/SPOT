import './FreeSelectInput.css';
import React, { useState } from 'react';
import { useDetectClickOutside } from 'react-detect-click-outside';

/**
 * A dropdown input that also allows free typing (or in other words: a text input with suggestions)
 */
const FreeSelectInput = ({ placeholder, options, disabled, value, onChange }) => {

	const [ state, setState ] = useState({
		open: false,
		changedAfterOpen: false
	});

	const ref = useDetectClickOutside({
		onTriggered: (e) => {
			if(state.open) {
				e.stopPropagation();
				setState(() => {
					return {
						open: false,
						changedAfterOpen: false
					};
				});
			}
		}
	});

	// Filter dropdown options, but only after the user typed something in the free text input
	const filteredOptions = state.changedAfterOpen && value ?
		options.filter((option) => {
			return option.toLowerCase().indexOf(value.toLowerCase()) !== -1;
		}) :
		options;

	return (
		<div className={`free-select-input free-select-input-${state.open ? 'open' : 'closed'}`} ref={ref}>
			<div className='free-select-input-fixed-container'>
				<input
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
						if(state.open && !state.changedAfterOpen) {
							setState(() => {
								return {
									open: true,
									changedAfterOpen: true
								};
							});
						}
					}}
					onFocus={() => {
						setState(() => {
							return {
								open: true,
								changedAfterOpen: false
							};
						});
					}}
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
										setState(() => {
											return {
												open: false,
												changedAfterOpen: false
											};
										});
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

