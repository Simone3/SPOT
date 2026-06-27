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

const loadWindowLoadTarget = () => {
	return import(pathToFileURL(path.join(__dirname, 'src/main/window/WindowLoadTarget.ts')).href);
};

const loadWindowTarget = (win, loadTarget) => {
	if(loadTarget.type === 'file') {
		win.loadFile(loadTarget.value);
		return;
	}

	win.loadURL(loadTarget.value);
};

const createWindow = ({ resolveWindowLoadTarget }) => {
	const win = new BrowserWindow({
		width: 800,
		height: 600,
		webPreferences: {
			preload: path.join(__dirname, 'preload.js')
		}
	});

	const loadTarget = resolveWindowLoadTarget({
		isPackaged: app.isPackaged,
		appRootDirectory: __dirname
	});

	loadWindowTarget(win, loadTarget);
};

app.whenReady().then(async() => {
	const [
		{ registerTaskStorageIpcHandlers },
		{ resolveWindowLoadTarget }
	] = await Promise.all([
		loadTaskStorageIpc(),
		loadWindowLoadTarget()
	]);

	ipcMain.handle('ping', () => 'pong');
	registerTaskStorageIpcHandlers({
		app,
		ipcMain
	});

	createWindow({ resolveWindowLoadTarget });

	app.on('activate', () => {
		if(BrowserWindow.getAllWindows().length === 0) {
			createWindow({ resolveWindowLoadTarget });
		}
	});
});

app.on('window-all-closed', () => {
	if(process.platform !== 'darwin') {
		app.quit();
	}
});
