import type { Menu, MenuItemConstructorOptions } from 'electron';
import type { SpotTranslator } from 'src/i18n/Translations';
import { SPOT_MENU_COMMANDS, type SpotMenu } from 'src/types/AppMenuTypes';

/**
 * The application menu.
 *
 * SPOT builds its own rather than shipping the one Electron installs when nobody asks, because that default menu carries the
 * developer entries: reload, force reload and the developer tools. Those belong to a development run and not to an installed
 * application, where reloading throws away whatever the renderer still buffers and the tools are an invitation to break things.
 *
 * Almost every entry is an Electron role rather than a command of SPOT's own. A role brings its own label, its own accelerator and
 * its own behaviour, worded in the language the operating system runs in, which is closer than a bundled translation gets. The Edit
 * menu in particular is not decoration: on macOS the standard editing shortcuts are the accelerators of those menu items, so a
 * window without an Edit menu is a window where the user cannot copy or paste inside a task.
 *
 * On Windows that native menu is installed but never shown: the operating system draws it in its own grey, above a window that is
 * dark, and nothing in Electron can restyle it. The window there hides the menu bar and draws it in the renderer instead, in the
 * colors of the application, which is what "buildSpotDrawnMenuBar()" describes. The hidden native menu stays installed because it is
 * what answers the keyboard: its roles carry the accelerators, so the drawn bar only has to say what they are and to run the same
 * commands when it is clicked.
 */

// What this module needs of Electron's Menu, which is the whole of it: building a template and installing the result
export type ApplicationMenu = Pick<typeof Menu, 'buildFromTemplate' | 'setApplicationMenu'>;

// The platforms disagree on where the application's own entries go, and on nothing else in this menu
export type MenuPlatform = typeof process.platform;

// macOS expects the first submenu to be the application's own, holding About, Hide and Quit under the application name. The other
// platforms expect Quit in a File menu instead, which is the only entry SPOT has to put there.
const buildFirstSubmenu = (translator: SpotTranslator, isMacOs: boolean): MenuItemConstructorOptions => {
	if(isMacOs) {
		return { role: 'appMenu' };
	}

	return {
		label: translator.t('menu.file'),
		submenu: [ { role: 'quit' } ]
	};
};

export interface BuildSpotMenuTemplateOptions {
	translator: SpotTranslator;
	platform: MenuPlatform;
}

/**
 * Builds the menu SPOT installs.
 * @param options How to build the menu.
 * @param options.translator The wording for the submenus that have no role to take a title from.
 * @param options.platform The platform to lay the menu out for.
 * @returns The menu template, top-level submenus in the order they appear.
 */
export const buildSpotMenuTemplate = ({ translator, platform }: BuildSpotMenuTemplateOptions): MenuItemConstructorOptions[] => {
	return [
		buildFirstSubmenu(translator, platform === 'darwin'),

		// Undo, cut, copy, paste and select all, and on macOS the shortcuts for them
		{ role: 'editMenu' },

		{
			label: translator.t('menu.view'),
			submenu: [
				{ role: 'resetZoom' },
				{ role: 'zoomIn' },
				{ role: 'zoomOut' },
				{ type: 'separator' },
				{ role: 'togglefullscreen' }
			]
		},

		{ role: 'windowMenu' }
	];
};

export interface DrawsOwnMenuBarOptions {
	platform: MenuPlatform;

	// A development run keeps the menu Electron installs by itself, which is a native menu bar like any other
	isDevelopmentRun: boolean;
}

/**
 * Tells whether SPOT draws the menu bar itself instead of leaving it to the operating system.
 * @param options Which platform and which kind of run this is.
 * @param options.platform The platform SPOT is running on.
 * @param options.isDevelopmentRun Whether this run keeps the menu Electron installs by itself.
 * @returns True when the window hides the native menu bar and the renderer draws one.
 */
export const drawsOwnMenuBar = ({ platform, isDevelopmentRun }: DrawsOwnMenuBarOptions): boolean => {
	// macOS puts the menu in the system menu bar at the top of the screen, where it belongs to the desktop and not to the window, and
	// it already looks like every other application there. Linux is left alone as well: hiding the native menu bar there means taking
	// the window buttons over too, which its desktop environments draw in ways SPOT cannot reproduce.
	return platform === 'win32' && !isDevelopmentRun;
};

// What each drawn entry shows on its right. These are display text: the hidden native menu answers the keystroke through the
// accelerator its role brings, so an entry changed here has to keep saying what that role actually listens for.
const WINDOWS_ACCELERATORS = {
	undo: 'Ctrl+Z',
	redo: 'Ctrl+Y',
	cut: 'Ctrl+X',
	copy: 'Ctrl+C',
	paste: 'Ctrl+V',
	selectAll: 'Ctrl+A',
	resetZoom: 'Ctrl+0',
	zoomIn: 'Ctrl++',
	zoomOut: 'Ctrl+-',
	toggleFullScreen: 'F11',
	minimize: 'Ctrl+M',
	close: 'Ctrl+W'
} as const;

/**
 * Builds the menu bar the renderer draws, which is the same menu as the native one in the wording of the translation bundle.
 * The two are built separately on purpose: the native one is roles, so that Electron keeps owning the accelerators and the
 * behaviour, and this one is labels and command names, because a menu drawn in the window has to know what to write on each entry.
 * @param translator The wording of every submenu and every entry.
 * @returns The submenus, in the order they appear.
 */
export const buildSpotDrawnMenuBar = (translator: SpotTranslator): SpotMenu[] => {
	return [
		{
			id: 'file',
			label: translator.t('menu.file'),
			items: [
				{ type: 'entry', command: SPOT_MENU_COMMANDS.exit, label: translator.t('menu.exit') }
			]
		},
		{
			id: 'edit',
			label: translator.t('menu.edit'),
			items: [
				{ type: 'entry', command: SPOT_MENU_COMMANDS.undo, label: translator.t('menu.undo'), accelerator: WINDOWS_ACCELERATORS.undo },
				{ type: 'entry', command: SPOT_MENU_COMMANDS.redo, label: translator.t('menu.redo'), accelerator: WINDOWS_ACCELERATORS.redo },
				{ type: 'separator' },
				{ type: 'entry', command: SPOT_MENU_COMMANDS.cut, label: translator.t('menu.cut'), accelerator: WINDOWS_ACCELERATORS.cut },
				{ type: 'entry', command: SPOT_MENU_COMMANDS.copy, label: translator.t('menu.copy'), accelerator: WINDOWS_ACCELERATORS.copy },
				{ type: 'entry', command: SPOT_MENU_COMMANDS.paste, label: translator.t('menu.paste'), accelerator: WINDOWS_ACCELERATORS.paste },
				{ type: 'separator' },
				{ type: 'entry', command: SPOT_MENU_COMMANDS.selectAll, label: translator.t('menu.selectAll'), accelerator: WINDOWS_ACCELERATORS.selectAll }
			]
		},
		{
			id: 'view',
			label: translator.t('menu.view'),
			items: [
				{ type: 'entry', command: SPOT_MENU_COMMANDS.resetZoom, label: translator.t('menu.resetZoom'), accelerator: WINDOWS_ACCELERATORS.resetZoom },
				{ type: 'entry', command: SPOT_MENU_COMMANDS.zoomIn, label: translator.t('menu.zoomIn'), accelerator: WINDOWS_ACCELERATORS.zoomIn },
				{ type: 'entry', command: SPOT_MENU_COMMANDS.zoomOut, label: translator.t('menu.zoomOut'), accelerator: WINDOWS_ACCELERATORS.zoomOut },
				{ type: 'separator' },
				{ type: 'entry', command: SPOT_MENU_COMMANDS.toggleFullScreen, label: translator.t('menu.toggleFullScreen'), accelerator: WINDOWS_ACCELERATORS.toggleFullScreen }
			]
		},
		{
			id: 'window',
			label: translator.t('menu.window'),
			items: [
				{ type: 'entry', command: SPOT_MENU_COMMANDS.minimize, label: translator.t('menu.minimize'), accelerator: WINDOWS_ACCELERATORS.minimize },
				{ type: 'entry', command: SPOT_MENU_COMMANDS.close, label: translator.t('menu.close'), accelerator: WINDOWS_ACCELERATORS.close }
			]
		}
	];
};

export interface InstallSpotApplicationMenuOptions extends BuildSpotMenuTemplateOptions {
	menu: ApplicationMenu;

	// A development run keeps the menu Electron installs by itself, developer entries and all, which is the point of running SPOT that way
	isDevelopmentRun: boolean;
}

/**
 * Puts SPOT's menu in place of Electron's default one, unless this is a development run.
 * @param options How to install the menu.
 * @param options.menu Electron's menu module, which builds the template and holds the installed result.
 * @param options.isDevelopmentRun Whether this run keeps the default menu instead.
 * @param options.translator The wording for the submenus that have no role to take a title from.
 * @param options.platform The platform to lay the menu out for.
 */
export const installSpotApplicationMenu = ({ menu, isDevelopmentRun, translator, platform }: InstallSpotApplicationMenuOptions): void => {
	if(isDevelopmentRun) {
		return;
	}

	menu.setApplicationMenu(menu.buildFromTemplate(buildSpotMenuTemplate({ translator, platform })));
};
