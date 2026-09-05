import type { BackupSettingsStore } from 'src/framework/main/config/BackupLocationManager';
import { createJsonConfigStore, type JsonConfigStore } from 'src/framework/main/config/JsonConfigStore';

export interface SpotConfig {
	backupDirectory?: string;
	retainedBackupCount?: number;
}

export type SpotConfigStore = JsonConfigStore<SpotConfig>;

// Called with "undefined" when the configuration file is missing or unreadable, which is why every field is optional here
const parseSpotConfig = (content: unknown): SpotConfig => {
	if(!content || typeof content !== 'object') {
		return {};
	}

	const { backupDirectory, retainedBackupCount } = content as Partial<Record<keyof SpotConfig, unknown>>;

	return {
		backupDirectory: typeof backupDirectory === 'string' && backupDirectory ? backupDirectory : undefined,

		// Held to its range by the backup settings manager, which owns what a usable count is: a file that says something else only
		// has to reach it as a number for that to happen
		retainedBackupCount: typeof retainedBackupCount === 'number' ? retainedBackupCount : undefined
	};
};

export const createSpotConfigStore = (configFilePath: string): SpotConfigStore => {
	return createJsonConfigStore({
		filePath: configFilePath,
		parse: parseSpotConfig
	});
};

// The backup settings reach the configuration file through this narrow view of it, which keeps the manager out of the file's shape.
// The file is written whole, so what is written here is merged onto what is already in it: saving the backup settings must never be
// what loses a preference stored beside them.
export const createSpotBackupSettingsStore = (configStore: SpotConfigStore): BackupSettingsStore => {
	return {
		read: () => {
			const { backupDirectory, retainedBackupCount } = configStore.read();

			return {
				directory: backupDirectory,
				retainedBackupCount
			};
		},
		write: ({ directory, retainedBackupCount }) => {
			configStore.write({
				...configStore.read(),
				backupDirectory: directory,
				retainedBackupCount
			});
		}
	};
};
