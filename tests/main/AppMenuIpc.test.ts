import type { App, BrowserWindow, IpcMain, IpcMainInvokeEvent } from 'electron';
import { ZOOM_CONFIG } from 'src/config/AppConfig';
import { registerAppMenuIpcHandlers, SPOT_APP_MENU_IPC_CHANNELS } from 'src/main/ipc/AppMenuIpc';
import { SPOT_MENU_COMMANDS, type SpotMenu } from 'src/types/AppMenuTypes';

type RegisteredIpcHandler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown;

type MockSpy = ReturnType<typeof vi.fn>;

// The spies are kept beside the window rather than read back off it, so a test asserts on a plain function and not on a method
type MockWindow = {
	window: BrowserWindow;
	spies: Record<'minimize' | 'close' | 'setFullScreen' | 'undo' | 'redo' | 'cut' | 'copy' | 'paste' | 'selectAll', MockSpy>;
	getZoomLevel: () => number;
};

const MENU_BAR: SpotMenu[] = [{
	id: 'file',
	label: 'File',
	items: [{ type: 'entry', command: SPOT_MENU_COMMANDS.exit, label: 'Exit' }]
}];

const createMockIpcMain = (): {
	handlers: Map<string, RegisteredIpcHandler>;
	ipcMain: Pick<IpcMain, 'handle'>;
} => {
	const handlers = new Map<string, RegisteredIpcHandler>();
	const ipcMain = {
		handle: vi.fn((channel: string, handler: RegisteredIpcHandler) => {
			handlers.set(channel, handler);
		})
	};

	return {
		handlers,
		ipcMain
	};
};

const createMockWindow = (): MockWindow => {
	let zoomLevel = 0;
	let isFullScreen = false;

	const spies: MockWindow['spies'] = {
		minimize: vi.fn(),
		close: vi.fn(),
		setFullScreen: vi.fn((wanted: boolean) => {
			isFullScreen = wanted;
		}),
		undo: vi.fn(),
		redo: vi.fn(),
		cut: vi.fn(),
		copy: vi.fn(),
		paste: vi.fn(),
		selectAll: vi.fn()
	};

	const window = {
		isDestroyed: () => {
			return false;
		},
		minimize: spies.minimize,
		close: spies.close,
		isFullScreen: () => {
			return isFullScreen;
		},
		setFullScreen: spies.setFullScreen,
		webContents: {
			undo: spies.undo,
			redo: spies.redo,
			cut: spies.cut,
			copy: spies.copy,
			paste: spies.paste,
			selectAll: spies.selectAll,
			getZoomLevel: () => {
				return zoomLevel;
			},
			setZoomLevel: (level: number) => {
				zoomLevel = level;
			}
		}
	} as unknown as BrowserWindow;

	return {
		window,
		spies,
		getZoomLevel: () => {
			return zoomLevel;
		}
	};
};

const registerHandlers = (window: BrowserWindow | undefined): {
	runCommand: (command: unknown) => void;
	getMenuBar: () => SpotMenu[];
	quit: MockSpy;
} => {
	const { handlers, ipcMain } = createMockIpcMain();
	const quit = vi.fn();

	registerAppMenuIpcHandlers({
		ipcMain,
		menuBar: MENU_BAR,
		commandTarget: {
			app: { quit } as unknown as Pick<App, 'quit'>,
			getWindow: () => {
				return window;
			}
		}
	});

	return {
		runCommand: (command: unknown) => {
			handlers.get(SPOT_APP_MENU_IPC_CHANNELS.runMenuCommand)!({} as IpcMainInvokeEvent, command);
		},
		getMenuBar: () => {
			return handlers.get(SPOT_APP_MENU_IPC_CHANNELS.getMenuBar)!({} as IpcMainInvokeEvent) as SpotMenu[];
		},
		quit
	};
};

describe('AppMenuIpc', () => {
	test('answers with the menu bar it was given', () => {
		expect(registerHandlers(createMockWindow().window).getMenuBar()).toEqual(MENU_BAR);
	});

	// The editing entries are the reason a drawn menu bar has to reach the main process at all: they act on the window's own selection
	test.each([
		[ SPOT_MENU_COMMANDS.undo, 'undo' ],
		[ SPOT_MENU_COMMANDS.redo, 'redo' ],
		[ SPOT_MENU_COMMANDS.cut, 'cut' ],
		[ SPOT_MENU_COMMANDS.copy, 'copy' ],
		[ SPOT_MENU_COMMANDS.paste, 'paste' ],
		[ SPOT_MENU_COMMANDS.selectAll, 'selectAll' ]
	] as const)('runs "%s" on the window contents', (command, method) => {
		const { window, spies } = createMockWindow();

		registerHandlers(window).runCommand(command);

		expect(spies[method]).toHaveBeenCalledOnce();
	});

	test('zooms in and out by one step and back to the normal size', () => {
		const { window, getZoomLevel } = createMockWindow();
		const { runCommand } = registerHandlers(window);

		runCommand(SPOT_MENU_COMMANDS.zoomIn);
		expect(getZoomLevel()).toBe(ZOOM_CONFIG.stepLevel);

		runCommand(SPOT_MENU_COMMANDS.zoomOut);
		expect(getZoomLevel()).toBe(0);

		runCommand(SPOT_MENU_COMMANDS.zoomIn);
		runCommand(SPOT_MENU_COMMANDS.resetZoom);
		expect(getZoomLevel()).toBe(0);
	});

	// Zooming without an end would leave the application unreadable, with no way back but the entries nobody can read anymore
	test('stops zooming where the application stops being usable', () => {
		const { window, getZoomLevel } = createMockWindow();
		const { runCommand } = registerHandlers(window);

		for(let step = 0; step < 100; step++) {
			runCommand(SPOT_MENU_COMMANDS.zoomIn);
		}

		expect(getZoomLevel()).toBe(ZOOM_CONFIG.maximumLevel);

		for(let step = 0; step < 200; step++) {
			runCommand(SPOT_MENU_COMMANDS.zoomOut);
		}

		expect(getZoomLevel()).toBe(ZOOM_CONFIG.minimumLevel);
	});

	test('toggles full screen', () => {
		const { window, spies } = createMockWindow();
		const { runCommand } = registerHandlers(window);

		runCommand(SPOT_MENU_COMMANDS.toggleFullScreen);
		expect(spies.setFullScreen).toHaveBeenLastCalledWith(true);

		runCommand(SPOT_MENU_COMMANDS.toggleFullScreen);
		expect(spies.setFullScreen).toHaveBeenLastCalledWith(false);
	});

	test.each([
		[ SPOT_MENU_COMMANDS.minimize, 'minimize' ],
		[ SPOT_MENU_COMMANDS.close, 'close' ]
	] as const)('runs "%s" on the window', (command, method) => {
		const { window, spies } = createMockWindow();

		registerHandlers(window).runCommand(command);

		expect(spies[method]).toHaveBeenCalledOnce();
	});

	test('quits the application', () => {
		const { runCommand, quit } = registerHandlers(createMockWindow().window);

		runCommand(SPOT_MENU_COMMANDS.exit);

		expect(quit).toHaveBeenCalledOnce();
	});

	// The bridge is a closed set of commands and not a way of reaching whatever the main process can do
	test.each([ 'reload', 'toggle-dev-tools', '', 42 ])('ignores what is not one of its commands (%s)', (command) => {
		const { window, spies } = createMockWindow();

		expect(() => {
			registerHandlers(window).runCommand(command);
		}).not.toThrow();

		expect(spies.minimize).not.toHaveBeenCalled();
		expect(spies.copy).not.toHaveBeenCalled();
	});

	// A menu clicked while the window is going away has nothing left to act on
	test('does nothing without a window', () => {
		const { runCommand, quit } = registerHandlers(undefined);

		expect(() => {
			runCommand(SPOT_MENU_COMMANDS.exit);
		}).not.toThrow();

		expect(quit).not.toHaveBeenCalled();
	});
});
