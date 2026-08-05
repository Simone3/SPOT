import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// The config is loaded as a real ES module, which has no "__dirname"
const CONFIG_DIRECTORY = import.meta.dirname;

// Electron loads the built "index.html" from disk in development and packaged alike, so asset URLs must stay relative
const RELATIVE_ASSET_BASE = './';

// The React sources import each other through absolute "src/..." specifiers, which Vite resolves through this alias
const SOURCE_ALIAS = {
	src: path.resolve(CONFIG_DIRECTORY, 'src')
};

// The output folder is the one the Electron main process and the packaging step already expect
const REACT_BUILD_DIRECTORY = 'build';

// The renderer only ever runs in the Chromium that Electron bundles, so the output is not downlevelled for other browsers.
// This replaces the browser list that Create React App used to read from "package.json".
const ELECTRON_CHROMIUM_TARGET = 'chrome150';

export default defineConfig({
	plugins: [ react() ],
	base: RELATIVE_ASSET_BASE,
	resolve: {
		alias: SOURCE_ALIAS
	},
	build: {
		outDir: REACT_BUILD_DIRECTORY,
		emptyOutDir: true,
		target: ELECTRON_CHROMIUM_TARGET
	},
	test: {
		globals: true,
		environment: 'jsdom',
		include: [ 'tests/**/*.{test,spec}.{ts,tsx}' ],
		setupFiles: [ 'tests/setupTests.ts' ]
	}
});
