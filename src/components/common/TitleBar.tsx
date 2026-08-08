import 'src/components/common/TitleBar.css';
import { useEffect, useState, type ReactElement } from 'react';
import { MenuBar } from 'src/components/common/MenuBar';
import { loadDrawnMenuBar, runMenuCommand } from 'src/logic/AppMenu';
import type { SpotMenu } from 'src/types/AppMenuTypes';

/**
 * The row SPOT draws in place of the title bar the operating system would.
 *
 * It exists only where the main process hid the native one, which today is Windows: the menu bar there is drawn by the operating
 * system in a grey nothing can change, above a window that is dark, and the two never look like one application. Everywhere else the
 * main process answers with no menu at all, this renders nothing, and the window keeps the title bar and the menu bar it has always
 * had. The window buttons are never drawn here: Electron keeps overlaying the real ones on the right of this row, in the colors it was
 * given, so minimizing, maximizing and closing stay the operating system's own.
 */

// The main process is the only side that knows whether the native menu bar was hidden, so the menu is asked for once when the row mounts
const useDrawnMenuBar = (): SpotMenu[] => {
	const [ menus, setMenus ] = useState<SpotMenu[]>([]);

	useEffect(() => {
		let didCancelLoad = false;

		void loadDrawnMenuBar().then((loadedMenus) => {
			if(!didCancelLoad) {
				setMenus(loadedMenus);
			}
		});

		return () => {
			didCancelLoad = true;
		};
	}, []);

	return menus;
};

const TitleBar = (): ReactElement | null => {
	const menus = useDrawnMenuBar();

	if(menus.length === 0) {
		return null;
	}

	return (
		<div id='title-bar'>
			<MenuBar menus={menus} onCommand={runMenuCommand}/>

			{/* The name of the window, where a title bar puts it. It is read from the document rather than translated, because it is
			    the name of the application and not a word. */}
			<div className='title-bar-title'>{document.title}</div>
		</div>
	);
};

export { TitleBar };
