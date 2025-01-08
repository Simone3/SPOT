import { createContext, useRef } from 'react';

export const ClickOutsideContext = createContext();

export const ClickOutsideContextProvider = ({ children }) => {
	const ref = useRef(0);

	return (
		<ClickOutsideContext.Provider
			value={ref}>
			{children}
		</ClickOutsideContext.Provider>
	);
};
