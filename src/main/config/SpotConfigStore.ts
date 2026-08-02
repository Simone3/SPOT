import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spotLogger } from 'src/main/logging/SpotLogger';

export interface SpotConfig {
	databaseDirectory?: string;
}

export interface SpotConfigStore {
	read: () => SpotConfig;
	write: (config: SpotConfig) => void;
}

const parseSpotConfig = (content: string): SpotConfig => {
	const parsedContent: unknown = JSON.parse(content);

	if(!parsedContent || typeof parsedContent !== 'object') {
		return {};
	}

	const { databaseDirectory } = parsedContent as Partial<Record<keyof SpotConfig, unknown>>;

	return {
		databaseDirectory: typeof databaseDirectory === 'string' && databaseDirectory ? databaseDirectory : undefined
	};
};

// A missing or unreadable configuration file is treated as an empty configuration, so a corrupted file behaves like a first startup instead of blocking the app
export const createSpotConfigStore = (configFilePath: string): SpotConfigStore => {
	const read = (): SpotConfig => {
		try {
			return parseSpotConfig(readFileSync(configFilePath, 'utf8'));
		}
		catch {
			return {};
		}
	};

	const write = (config: SpotConfig): void => {
		try {
			mkdirSync(path.dirname(configFilePath), { recursive: true });
			writeFileSync(configFilePath, `${JSON.stringify(config, undefined, '\t')}\n`, 'utf8');
		}
		catch(error) {
			spotLogger.error('Could not write the SPOT configuration file', {
				type: 'config.write',
				configFilePath,
				error: String(error)
			});
		}
	};

	return {
		read,
		write
	};
};
