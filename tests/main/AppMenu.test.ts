import type { Menu, MenuItemConstructorOptions } from 'electron';
import { makeTranslator } from '../testUtils';
import { buildSpotMenuTemplate, installSpotApplicationMenu, type ApplicationMenu } from 'src/main/window/AppMenu';

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
