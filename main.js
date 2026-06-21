const { app, BrowserWindow, ipcMain } = require('electron/main');
const { statSync } = require('node:fs');
const { registerHooks } = require('node:module');
const path = require('node:path');
const { fileURLToPath, pathToFileURL } = require('node:url');

const sourceModuleExtensions = [ '', '.ts', '.tsx', '.js', '.jsx', '.json' ];

const getExistingFilePath = (candidatePath) => {
	try {
		if(statSync(candidatePath).isFile()) {
			return candidatePath;
		}
	}
	catch {
		return undefined;
	}

	return undefined;
};

const resolveSourceModulePath = (modulePath) => {
	for(const extension of sourceModuleExtensions) {
		const candidatePath = getExistingFilePath(`${modulePath}${extension}`);
		if(candidatePath) {
			return candidatePath;
		}
	}

	for(const extension of sourceModuleExtensions.slice(1)) {
		const candidatePath = getExistingFilePath(path.join(modulePath, `index${extension}`));
		if(candidatePath) {
			return candidatePath;
		}
	}

	return undefined;
};

const isTypeScriptModulePath = (modulePath) => {
	return modulePath.endsWith('.ts');
};

const isRepositoryFileUrl = (url) => {
	if(!url || !url.startsWith('file:')) {
		return false;
	}

	const filePath = fileURLToPath(url);
	const relativePath = path.relative(__dirname, filePath);

	return relativePath === 'src' || relativePath.startsWith(`src${path.sep}`);
};

const resolveRepositoryModuleSpecifier = (specifier, parentURL) => {
	if(specifier.startsWith('src/')) {
		return resolveSourceModulePath(path.join(__dirname, specifier));
	}

	if((specifier.startsWith('./') || specifier.startsWith('../')) && isRepositoryFileUrl(parentURL)) {
		return resolveSourceModulePath(path.resolve(path.dirname(fileURLToPath(parentURL)), specifier));
	}

	return undefined;
};

const resolveModule = (modulePath, context, nextResolve) => {
	const moduleUrl = pathToFileURL(modulePath).href;

	if(isTypeScriptModulePath(modulePath)) {
		return {
			url: moduleUrl,
			format: 'module-typescript',
			shortCircuit: true
		};
	}

	return nextResolve(moduleUrl, context);
};

const registerRepositoryTypeScriptResolver = () => {
	if(typeof registerHooks !== 'function') {
		return;
	}

	registerHooks({
		resolve(specifier, context, nextResolve) {
			if(specifier.startsWith('file:') && isRepositoryFileUrl(specifier) && isTypeScriptModulePath(fileURLToPath(specifier))) {
				return {
					url: specifier,
					format: 'module-typescript',
					shortCircuit: true
				};
			}

			const modulePath = resolveRepositoryModuleSpecifier(specifier, context.parentURL);

			if(modulePath) {
				return resolveModule(modulePath, context, nextResolve);
			}

			return nextResolve(specifier, context);
		}
	});
};

registerRepositoryTypeScriptResolver();

const loadTaskStorageIpc = () => {
	return import(pathToFileURL(path.join(__dirname, 'src/main/ipc/TaskStorageIpc.ts')).href);
};

const createWindow = () => {
	const win = new BrowserWindow({
		width: 800,
		height: 600,
		webPreferences: {
			preload: path.join(__dirname, 'preload.js')
		}
	});

	// TODO https://www.electronjs.org/docs/latest/tutorial/security#18-avoid-usage-of-the-file-protocol-and-prefer-usage-of-custom-protocols
	// `file://${path.join(__dirname, '../build/index.html')}`;
	const startURL = 'http://localhost:3000';

	win.loadURL(startURL);
};

app.whenReady().then(async() => {
	const { registerTaskStorageIpcHandlers } = await loadTaskStorageIpc();

	ipcMain.handle('ping', () => 'pong');
	registerTaskStorageIpcHandlers({
		app,
		ipcMain
	});

	createWindow();

	app.on('activate', () => {
		if(BrowserWindow.getAllWindows().length === 0) {
			createWindow();
		}
	});
});

app.on('window-all-closed', () => {
	if(process.platform !== 'darwin') {
		app.quit();
	}
});
