import type { IpcMain, IpcMainInvokeEvent } from 'electron';
import { registerAppInfoIpcHandlers, SPOT_APP_INFO_IPC_CHANNELS } from 'src/main/ipc/AppInfoIpc';
import type { SpotAppInfo } from 'src/types/AppInfoTypes';

type RegisteredIpcHandler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown;

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

describe('AppInfoIpc', () => {
	test('registers the app info channel', () => {
		const { handlers, ipcMain } = createMockIpcMain();

		registerAppInfoIpcHandlers({
			ipcMain,
			app: {
				getVersion: () => {
					return '1.0.0';
				}
			}
		});

		expect([ ...handlers.keys() ]).toEqual([ SPOT_APP_INFO_IPC_CHANNELS.getAppInfo ]);
	});

	test('answers with the version Electron reports for the running application', () => {
		const { handlers, ipcMain } = createMockIpcMain();

		registerAppInfoIpcHandlers({
			ipcMain,
			app: {
				getVersion: () => {
					return '2.4.1';
				}
			}
		});

		const handler = handlers.get(SPOT_APP_INFO_IPC_CHANNELS.getAppInfo);

		expect(handler?.({} as IpcMainInvokeEvent)).toEqual({ version: '2.4.1' } satisfies SpotAppInfo);
	});

	// The version is read on every request rather than captured once, so an application that reports a different one is followed
	test('reads the version again on every request', () => {
		const { handlers, ipcMain } = createMockIpcMain();
		const getVersion = vi.fn(() => {
			return '1.0.0';
		});

		registerAppInfoIpcHandlers({ ipcMain, app: { getVersion } });

		const handler = handlers.get(SPOT_APP_INFO_IPC_CHANNELS.getAppInfo);
		handler?.({} as IpcMainInvokeEvent);
		handler?.({} as IpcMainInvokeEvent);

		expect(getVersion).toHaveBeenCalledTimes(2);
	});
});
