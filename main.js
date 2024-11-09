const { app, BrowserWindow, ipcMain } = require('electron/main');
const path = require('node:path');

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

app.whenReady().then(() => {
	ipcMain.handle('ping', () => 'pong');

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
