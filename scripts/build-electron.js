const esbuild = require('esbuild');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.join(__dirname, '..');
const electronOutputDirectory = path.join(projectRoot, 'dist', 'electron');

fs.rmSync(electronOutputDirectory, {
	force: true,
	recursive: true
});

esbuild.build({
	bundle: true,
	entryPoints: {
		main: path.join(projectRoot, 'src', 'main', 'Main.ts'),
		preload: path.join(projectRoot, 'src', 'main', 'preload', 'Preload.ts')
	},
	external: [
		'electron',
		'electron/main',
		'electron-log'
	],
	format: 'cjs',
	logLevel: 'info',
	outdir: electronOutputDirectory,
	platform: 'node',
	sourcemap: true,
	sourcesContent: false,
	target: 'node20',
	tsconfig: path.join(projectRoot, 'tsconfig.json')
}).catch((error) => {
	console.error(error);
	process.exit(1);
});
