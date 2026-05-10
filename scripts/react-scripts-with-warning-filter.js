const script = process.argv[2];

if (script !== "start" && script !== "build") {
	console.error("Usage: node scripts/react-scripts-with-warning-filter.js <start|build>");
	process.exit(1);
}

process.env.BABEL_ENV = script === "start" ? "development" : "production";
process.env.NODE_ENV = script === "start" ? "development" : "production";

if (script === "start" && process.env.BROWSER === undefined) {
	process.env.BROWSER = "google chrome";
}

function normalizePath(value) {
	return value.replace(/\\/g, "/");
}

function isDndKitReactSourceMapWarning(warning) {
	const message = normalizePath(`${warning.message || ""}\n${warning.details || ""}`);
	const resource = normalizePath(warning.module && warning.module.resource ? warning.module.resource : "");
	const dndKitReactFile = /node_modules\/@dnd-kit\/react\/(?:hooks|index|sortable|utilities)\.js(?:\.map)?/;

	return message.includes("Failed to parse source map")
		&& (
			dndKitReactFile.test(message)
			|| dndKitReactFile.test(resource)
		);
}

function patchWebpackConfigFactory() {
	const webpackConfigPath = require.resolve("react-scripts/config/webpack.config");
	const createWebpackConfig = require(webpackConfigPath);

	require.cache[webpackConfigPath].exports = (...args) => {
		const config = createWebpackConfig(...args);

		config.ignoreWarnings = [
			...(config.ignoreWarnings || []),
			isDndKitReactSourceMapWarning,
		];

		return config;
	};
}

patchWebpackConfigFactory();

const scriptPath = require.resolve(`react-scripts/scripts/${script}`);
process.argv = [process.argv[0], scriptPath, ...process.argv.slice(3)];
require(scriptPath);
