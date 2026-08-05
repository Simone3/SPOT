import type { BackupDirectoryStore } from 'src/framework/main/config/BackupLocationManager';
import { createJsonConfigStore, type JsonConfigStore } from 'src/framework/main/config/JsonConfigStore';

export interface SpotConfig {
	backupDirectory?: string;
}

export type SpotConfigStore = JsonConfigStore<SpotConfig>;

// Called with "undefined" when the configuration file is missing or unreadable, which is why every field is optional here
const parseSpotConfig = (content: unknown): SpotConfig => {
	if(!content || typeof content !== 'object') {
		return {};
	}

	const { backupDirectory } = content as Partial<Record<keyof SpotConfig, unknown>>;

	return {
		backupDirectory: typeof backupDirectory === 'string' && backupDirectory ? backupDirectory : undefined
	};
};

export const createSpotConfigStore = (configFilePath: string): SpotConfigStore => {
	return createJsonConfigStore({
		filePath: configFilePath,
		parse: parseSpotConfig
	});
};

// The backup folder is the only setting the backup location manager needs, so it reaches the configuration file through this narrow view of it
export const createSpotBackupDirectoryStore = (configStore: SpotConfigStore): BackupDirectoryStore => {
	return {
		read: () => {
			return configStore.read().backupDirectory;
		},
		write: (directory: string) => {
			configStore.write({ backupDirectory: directory });
		}
	};
};
