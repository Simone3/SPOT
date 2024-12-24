import './MultiSelect.css';
import { useState } from 'react';

const MultiSelect = ({ options }) => {
	// TODO change state and do not use indexes (?)
	const [ selected, setSelected ] = useState(new Array(options.length).fill(false));

	const onClick = (event, index) => {
		// const currentlySelected = selected[index];
		// const newSelectedArray = [ ...selected ];
		// newSelectedArray[index] = !currentlySelected;
		// setSelected(newSelectedArray);
		const currentlySelected = selected[index];
		if(event.metaKey || event.ctrlKey) {
			const newSelectedArray = [ ...selected ];
			newSelectedArray[index] = !currentlySelected;
			setSelected(newSelectedArray);
		}
		else {
			const selectedNumber = selected.reduce((c, v) => {
				return v ? c + 1 : c;
			});
			const newSelectedArray = new Array(options.length).fill(false);
			newSelectedArray[index] = selectedNumber > 1 ? true : !currentlySelected;
			setSelected(newSelectedArray);
		}
	};

	return (
		<div className='multi-select'>
			{options.map((option, index) => {
				return (
					<button key={option.key} onClick={(event) => onClick(event, index)} className={`option ${selected[index] ? 'option-selected' : 'option-unselected'}`}>
						{option.label}
					</button>
				);
			})}
		</div>
	);
};

export default MultiSelect;
