import type { Menu, MenuItemConstructorOptions } from 'electron';
import { makeTranslator } from '../testUtils';
import { buildSpotDrawnMenuBar, buildSpotMenuTemplate, drawsOwnMenuBar, installSpotApplicationMenu, type ApplicationMenu } from 'src/main/window/AppMenu';
import { SPOT_MENU_COMMANDS, type SpotMenuCommand } from 'src/types/AppMenuTypes';

const BUILT_MENU = {} as Menu;

const createMockMenu = (): {
	menu: ApplicationMenu;
	buildFromTemplate: ReturnType<typeof vi.fn>;
	setApplicationMenu: ReturnType<typeof vi.fn>;
} => {
	const buildFromTemplate = vi.fn(() => {
		return BUILT_MENU;
	});
	const setApplicationMenu = vi.fn();

	return {
		menu: { buildFromTemplate, setApplicationMenu } as unknown as ApplicationMenu,
		buildFromTemplate,
		setApplicationMenu
	};
};

const getRoles = (template: MenuItemConstructorOptions[]): (string | undefined)[] => {
	return template.map((item) => {
		return item.role;
	});
};

const findSubmenuRoles = (template: MenuItemConstructorOptions[], label: string): (string | undefined)[] => {
	const submenu = template.find((item) => {
		return item.label === label;
	})?.submenu;

	return Array.isArray(submenu) ? getRoles(submenu) : [];
};

describe('AppMenu', () => {
	const translator = makeTranslator();

	describe('buildSpotMenuTemplate', () => {
		// The application submenu is what macOS puts About and Quit in, and it is the only place the user finds them there
		test('starts with the application submenu on macOS', () => {
			const template = buildSpotMenuTemplate({ translator, platform: 'darwin' });

			expect(template[0]?.role).toBe('appMenu');
		});

		// Every other platform expects Quit in a File menu instead, so it cannot be left out with the application submenu
		test('offers Quit in a File submenu off macOS', () => {
			const template = buildSpotMenuTemplate({ translator, platform: 'win32' });

			expect(getRoles(template)).not.toContain('appMenu');
			expect(findSubmenuRoles(template, translator.t('menu.file'))).toEqual([ 'quit' ]);
		});

		// The Edit submenu carries the standard editing accelerators on macOS, so a menu without it is a SPOT where the user
		// cannot copy or paste inside a task
		test.each([ 'darwin', 'win32', 'linux' ] as const)('always offers the Edit submenu on %s', (platform) => {
			expect(getRoles(buildSpotMenuTemplate({ translator, platform }))).toContain('editMenu');
		});

		// The developer entries belong to the menu Electron installs by itself, which is exactly what SPOT replaces
		test.each([ 'darwin', 'win32', 'linux' ] as const)('offers no reload or developer tools entry on %s', (platform) => {
			const template = buildSpotMenuTemplate({ translator, platform });
			const everyRole = template.flatMap((item) => {
				return Array.isArray(item.submenu) ? [ item.role, ...getRoles(item.submenu) ] : [ item.role ];
			});

			expect(everyRole).not.toContain('reload');
			expect(everyRole).not.toContain('forceReload');
			expect(everyRole).not.toContain('toggleDevTools');
		});

		test('offers zoom and full screen in the View submenu', () => {
			const template = buildSpotMenuTemplate({ translator, platform: 'darwin' });

			expect(findSubmenuRoles(template, translator.t('menu.view'))).toEqual([
				'resetZoom',
				'zoomIn',
				'zoomOut',
				undefined,
				'togglefullscreen'
			]);
		});
	});

	describe('drawsOwnMenuBar', () => {
		// The native menu bar on Windows is grey, above a dark window, and nothing in Electron restyles it
		test('draws the menu bar on Windows', () => {
			expect(drawsOwnMenuBar({ platform: 'win32', isDevelopmentRun: false })).toBe(true);
		});

		// macOS keeps its menu in the system menu bar, where it belongs to the desktop, and Linux draws its own window decorations
		test.each([ 'darwin', 'linux' ] as const)('leaves the menu bar to the operating system on %s', (platform) => {
			expect(drawsOwnMenuBar({ platform, isDevelopmentRun: false })).toBe(false);
		});

		// A development run keeps the menu Electron installs by itself, developer entries and all, so it has a native menu bar to show
		test('leaves the menu bar alone in a development run', () => {
			expect(drawsOwnMenuBar({ platform: 'win32', isDevelopmentRun: true })).toBe(false);
		});
	});

	describe('buildSpotDrawnMenuBar', () => {
		test('offers the same submenus as the native menu', () => {
			const menus = buildSpotDrawnMenuBar(translator).map((menu) => {
				return menu.label;
			});

			expect(menus).toEqual([
				translator.t('menu.file'),
				translator.t('menu.edit'),
				translator.t('menu.view'),
				translator.t('menu.window')
			]);
		});

		// A drawn entry has no Electron role behind it, so an entry whose command nothing implements is an entry that does nothing
		test('stands every entry on a known command', () => {
			const commands = new Set<SpotMenuCommand>(Object.values(SPOT_MENU_COMMANDS));

			for(const menu of buildSpotDrawnMenuBar(translator)) {
				for(const item of menu.items) {
					if(item.type === 'entry') {
						expect(commands).toContain(item.command);
					}
				}
			}
		});

		// Every command the main process implements is reachable, since the drawn bar is the only place they are offered from
		test('offers every command it implements', () => {
			const offeredCommands = buildSpotDrawnMenuBar(translator).flatMap((menu) => {
				return menu.items.flatMap((item) => {
					return item.type === 'entry' ? [ item.command ] : [];
				});
			});

			expect([ ...offeredCommands ].sort()).toEqual(Object.values(SPOT_MENU_COMMANDS).sort());
		});

		// The editing entries act on what the user was typing in, and they are the ones a menu bar cannot be shipped without
		test('offers the editing entries', () => {
			const editItems = buildSpotDrawnMenuBar(translator).find((menu) => {
				return menu.id === 'edit';
			})?.items ?? [];

			expect(editItems.filter((item) => {
				return item.type === 'entry';
			}).map((item) => {
				return item.label;
			})).toEqual([
				translator.t('menu.undo'),
				translator.t('menu.redo'),
				translator.t('menu.cut'),
				translator.t('menu.copy'),
				translator.t('menu.paste'),
				translator.t('menu.selectAll')
			]);
		});
	});

	describe('installSpotApplicationMenu', () => {
		test('installs the menu it built', () => {
			const { menu, buildFromTemplate, setApplicationMenu } = createMockMenu();

			installSpotApplicationMenu({
				menu,
				isDevelopmentRun: false,
				translator,
				platform: 'darwin'
			});

			expect(buildFromTemplate).toHaveBeenCalledOnce();
			expect(setApplicationMenu).toHaveBeenCalledWith(BUILT_MENU);
		});

		// A development run keeps Electron's default menu, developer entries and all, because that is the run they are for
		test('leaves the default menu alone in a development run', () => {
			const { menu, buildFromTemplate, setApplicationMenu } = createMockMenu();

			installSpotApplicationMenu({
				menu,
				isDevelopmentRun: true,
				translator,
				platform: 'darwin'
			});

			expect(buildFromTemplate).not.toHaveBeenCalled();
			expect(setApplicationMenu).not.toHaveBeenCalled();
		});
	});
});
