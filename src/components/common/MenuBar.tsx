import 'src/components/common/MenuBar.css';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { useTranslator } from 'src/i18n/TranslationContext';
import type { SpotMenu, SpotMenuCommand, SpotMenuItem } from 'src/types/AppMenuTypes';

/**
 * The menu bar SPOT draws itself, on the platforms where the native one cannot be made to look like the rest of the application.
 *
 * It behaves like the menu bar it replaces: a submenu opens on the first click and every other one then opens on hover, the keyboard
 * walks it with the arrow keys, and Escape closes it. What it deliberately does not do is take the focus. The Edit entries act on
 * whatever the user was typing in, and focus moved onto a menu button would be focus taken away from that field, so the pointer is
 * kept from moving it and the entry the keyboard is on is a highlight this component holds rather than the focused element. The bar
 * itself is still reachable by keyboard, because the submenu titles are ordinary buttons.
 */

type MenuBarProps = {
	menus: SpotMenu[];
	onCommand: (command: SpotMenuCommand) => void;
};

// Where the entry after (or before) the one at "fromIndex" is, skipping the separators and wrapping around the ends. Nothing is
// highlighted yet at -1, and a step down from there has to land on the first entry and a step up on the last.
const findEntryIndex = (items: SpotMenuItem[], fromIndex: number, step: number): number => {
	let index = fromIndex === -1 && step < 0 ? items.length : fromIndex;

	for(let attempt = 0; attempt < items.length; attempt++) {
		index = (index + step + items.length) % items.length;

		if(items[index]?.type === 'entry') {
			return index;
		}
	}

	return -1;
};

const MenuBar = ({ menus, onCommand }: MenuBarProps): ReactElement => {
	const { t } = useTranslator();

	const [ openMenuId, setOpenMenuId ] = useState<string | undefined>();

	// Which entry of the open submenu the keyboard is on, as an index into its items, or -1 when the pointer is driving the menu
	const [ highlightedIndex, setHighlightedIndex ] = useState(-1);

	const barRef = useRef<HTMLDivElement>(null);
	const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});

	const openMenu = menus.find((menu) => {
		return menu.id === openMenuId;
	});

	const closeMenu = (): void => {
		setOpenMenuId(undefined);
		setHighlightedIndex(-1);
	};

	const openMenuAt = (menuIndex: number, entryIndex: number): void => {
		const menu = menus[menuIndex];

		if(menu) {
			setOpenMenuId(menu.id);
			setHighlightedIndex(entryIndex);
		}
	};

	const focusTrigger = (menuIndex: number): void => {
		const menu = menus[(menuIndex + menus.length) % menus.length];

		if(menu) {
			triggerRefs.current[menu.id]?.focus();
		}
	};

	const runEntry = (item: SpotMenuItem | undefined): void => {
		if(item?.type === 'entry') {
			closeMenu();
			onCommand(item.command);
		}
	};

	useEffect(() => {
		if(!openMenu) {
			return undefined;
		}

		const openMenuIndex = menus.indexOf(openMenu);

		// The keys are taken in the capture phase, because the field the user was typing in still holds the focus while the menu is
		// open: an arrow key that reached it would move the caret behind the menu instead of moving through it
		const onDocumentKeyDown = (event: KeyboardEvent): void => {
			switch(event.key) {
				case 'Escape':
					closeMenu();

					// The focus only goes back to the submenu title when it came from there, so a menu opened with the pointer leaves
					// the field the user was typing in exactly where it was
					if(barRef.current?.contains(document.activeElement)) {
						triggerRefs.current[openMenu.id]?.focus();
					}
					break;

				case 'ArrowDown':
					setHighlightedIndex(findEntryIndex(openMenu.items, highlightedIndex, 1));
					break;

				case 'ArrowUp':
					setHighlightedIndex(findEntryIndex(openMenu.items, highlightedIndex, -1));
					break;

				case 'ArrowRight':
					openMenuAt((openMenuIndex + 1) % menus.length, -1);
					break;

				case 'ArrowLeft':
					openMenuAt((openMenuIndex - 1 + menus.length) % menus.length, -1);
					break;

				case 'Home':
					setHighlightedIndex(findEntryIndex(openMenu.items, -1, 1));
					break;

				case 'End':
					setHighlightedIndex(findEntryIndex(openMenu.items, -1, -1));
					break;

				case 'Enter':
				case ' ':
					runEntry(openMenu.items[highlightedIndex]);
					break;

				case 'Tab':
					closeMenu();
					return;

				default:
					return;
			}

			// Everything the menu answered is the menu's alone: the page behind it must not see it as well
			event.preventDefault();
			event.stopPropagation();
		};

		// A click anywhere else closes the menu, and it is taken on the press so that the click itself still reaches whatever was under it
		const onDocumentMouseDown = (event: MouseEvent): void => {
			if(!barRef.current?.contains(event.target as Node)) {
				closeMenu();
			}
		};

		document.addEventListener('keydown', onDocumentKeyDown, true);
		document.addEventListener('mousedown', onDocumentMouseDown, true);

		return () => {
			document.removeEventListener('keydown', onDocumentKeyDown, true);
			document.removeEventListener('mousedown', onDocumentMouseDown, true);
		};

		// Deliberately without a dependency list: the handlers read the open submenu and the highlighted entry, so they are the ones
		// this render built. There is nothing to save by keeping an older pair of them registered.
	});

	return (
		<div className='menu-bar' role='menubar' aria-label={t('menu.bar')} ref={barRef}>
			{menus.map((menu, menuIndex) => {
				const isOpen = menu.id === openMenuId;

				return (
					<div className='menu-bar-menu' key={menu.id}>
						<button
							type='button'
							role='menuitem'
							aria-haspopup='true'
							aria-expanded={isOpen}
							className={`menu-bar-trigger ${isOpen ? 'menu-bar-trigger-open' : ''}`}
							ref={(element) => {
								triggerRefs.current[menu.id] = element;
							}}
							onMouseDown={(event) => {
								// Nothing here ever takes the focus with the pointer: the Edit entries act on the field the user was
								// typing in, and a focused menu button would be that field having lost its selection
								event.preventDefault();

								if(isOpen) {
									closeMenu();
								}
								else {
									openMenuAt(menuIndex, -1);
								}
							}}
							onMouseEnter={() => {
								// Once one submenu is open the others open by being pointed at, which is what every menu bar does
								if(openMenuId && !isOpen) {
									openMenuAt(menuIndex, -1);
								}
							}}
							onKeyDown={(event) => {
								if(event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
									event.preventDefault();
									openMenuAt(menuIndex, event.key === 'ArrowDown' ? findEntryIndex(menu.items, -1, 1) : -1);
								}

								// While nothing is open the arrow keys walk the titles themselves, which is the other half of what
								// the keyboard does in a menu bar
								else if(event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
									event.preventDefault();
									focusTrigger(menuIndex + (event.key === 'ArrowRight' ? 1 : -1));
								}
							}}>
							{menu.label}
						</button>

						{isOpen && (
							<div className='menu-bar-dropdown' role='menu' aria-label={menu.label}>
								{menu.items.map((item, itemIndex) => {
									if(item.type === 'separator') {
										return <div className='menu-bar-separator' role='separator' key={`separator-${itemIndex}`}/>;
									}

									return (
										<button
											type='button'
											role='menuitem'
											tabIndex={-1}
											key={item.command}
											className={`menu-bar-entry ${itemIndex === highlightedIndex ? 'menu-bar-entry-highlighted' : ''}`}
											onMouseDown={(event) => {
												event.preventDefault();
											}}
											onMouseEnter={() => {
												setHighlightedIndex(itemIndex);
											}}
											onClick={() => {
												runEntry(item);
											}}>
											<span className='menu-bar-entry-label'>{item.label}</span>
											{item.accelerator && <span className='menu-bar-entry-accelerator'>{item.accelerator}</span>}
										</button>
									);
								})}
							</div>
						)}
					</div>
				);
			})}
		</div>
	);
};

export { MenuBar };
