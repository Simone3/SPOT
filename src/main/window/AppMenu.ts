import type { Menu, MenuItemConstructorOptions } from 'electron';
import type { SpotTranslator } from 'src/i18n/Translations';

/**
 * The native application menu.
 *
 * SPOT builds its own rather than shipping the one Electron installs when nobody asks, because that default menu carries the
 * developer entries: reload, force reload and the developer tools. Those belong to a development run and not to an installed
 * application, where reloading throws away whatever the renderer still buffers and the tools are an invitation to break things.
 *
 * Almost every entry is an Electron role rather than a command of SPOT's own. A role brings its own label, its own accelerator and
 * its own behaviour, worded in the language the operating system runs in, which is closer than a bundled translation gets. The Edit
 * menu in particular is not decoration: on macOS the standard editing shortcuts are the accelerators of those menu items, so a
 * window without an Edit menu is a window where the user cannot copy or paste inside a task.
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
