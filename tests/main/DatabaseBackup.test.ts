import { copyFileSync, existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { BACKUP_CONFIG, STORAGE_CONFIG } from 'src/config/AppConfig';
import { resetSpotLoggerForTests } from 'src/main/logging/SpotLogger';
import { createBackupFileName, createDatabaseBackup, isBackupFileName, readBackupFileNames } from 'src/main/storage/DatabaseBackup';
import { openSpotDatabase, type SpotDatabase } from 'src/main/storage/SpotDatabase';

const tempDirectories: string[] = [];
const openedDatabases: SpotDatabase[] = [];

const makeTempDirectory = (): string => {
	const directory = mkdtempSync(path.join(tmpdir(), 'spot-backup-'));
	tempDirectories.push(directory);

	return directory;
};

const openTrackedDatabase = (storageDirectory: string): SpotDatabase => {
	const spotDatabase = openSpotDatabase({
		storageDirectory,
		now: () => {
			return new Date('2026-06-06T09:00:00.000Z');
		}
	});
	openedDatabases.push(spotDatabase);

	return spotDatabase;
};

const createFixedDates = (): () => Date => {
	let index = 0;

	return () => {
		const minute = String(index).padStart(2, '0');
		index += 1;

		return new Date(`2026-06-06T10:${minute}:00.000Z`);
	};
};

describe('DatabaseBackup', () => {
	afterEach(() => {
		while(openedDatabases.length > 0) {
			openedDatabases.pop()!.close();
		}

		resetSpotLoggerForTests();

		while(tempDirectories.length > 0) {
			rmSync(tempDirectories.pop()!, { recursive: true, force: true });
		}
	});

	test('names backups so that they sort chronologically', () => {
		const older = createBackupFileName(new Date('2026-06-06T09:30:00.000Z'));
		const newer = createBackupFileName(new Date('2026-06-06T10:00:00.000Z'));

		expect(isBackupFileName(older)).toBe(true);
		expect([ newer, older ].sort()).toEqual([ older, newer ]);
		expect(isBackupFileName(BACKUP_CONFIG.temporaryFileName)).toBe(false);
		expect(isBackupFileName(`${older}${BACKUP_CONFIG.partialFileExtension}`)).toBe(false);
	});

	test('writes a complete database copy and leaves no temporary file behind', async() => {
		const storageDirectory = makeTempDirectory();
		const backupDirectory = makeTempDirectory();
		const database = openTrackedDatabase(storageDirectory);

		const backupPath = await createDatabaseBackup({
			database,
			backupDirectory,
			temporaryDirectory: storageDirectory
		});

		expect(existsSync(backupPath)).toBe(true);
		expect(existsSync(path.join(storageDirectory, BACKUP_CONFIG.temporaryFileName))).toBe(false);
		expect(await readBackupFileNames(backupDirectory)).toEqual([ path.basename(backupPath) ]);

		// A copy that cannot be opened as a SPOT database would be worthless as a backup
		const restoredDirectory = makeTempDirectory();
		copyFileSync(backupPath, path.join(restoredDirectory, STORAGE_CONFIG.databaseFileName));

		expect(openTrackedDatabase(restoredDirectory).getAppliedMigrationVersions()).toEqual([ STORAGE_CONFIG.currentSchemaVersion ]);
	});

	test('creates the backup folder when it does not exist yet', async() => {
		const storageDirectory = makeTempDirectory();
		const backupDirectory = path.join(makeTempDirectory(), 'nested', 'backups');
		const database = openTrackedDatabase(storageDirectory);

		await createDatabaseBackup({
			database,
			backupDirectory,
			temporaryDirectory: storageDirectory
		});

		expect(await readBackupFileNames(backupDirectory)).toHaveLength(1);
	});

	test('keeps only the most recent backups and leaves other files alone', async() => {
		const storageDirectory = makeTempDirectory();
		const backupDirectory = makeTempDirectory();
		const database = openTrackedDatabase(storageDirectory);
		const backupCount = BACKUP_CONFIG.retainedBackupCount + 3;
		const now = createFixedDates();
		writeFileSync(path.join(backupDirectory, 'notes.txt'), 'keep me', 'utf8');

		const backupPaths: string[] = [];

		for(let index = 0; index < backupCount; index++) {
			backupPaths.push(await createDatabaseBackup({
				database,
				backupDirectory,
				temporaryDirectory: storageDirectory,
				now
			}));
		}

		const remainingBackups = await readBackupFileNames(backupDirectory);

		expect(remainingBackups).toEqual(backupPaths.slice(-BACKUP_CONFIG.retainedBackupCount).map((backupPath) => {
			return path.basename(backupPath);
		}));
		expect(readdirSync(backupDirectory)).toContain('notes.txt');
	});

	// Shutdown can abandon a backup halfway through, and the file it leaves behind must not pile up
	test('clears a partial copy left behind by an interrupted backup', async() => {
		const storageDirectory = makeTempDirectory();
		const backupDirectory = makeTempDirectory();
		const database = openTrackedDatabase(storageDirectory);
		const abandonedPartialPath = path.join(
			backupDirectory,
			`${createBackupFileName(new Date('2026-06-06T09:00:00.000Z'))}${BACKUP_CONFIG.partialFileExtension}`
		);
		writeFileSync(abandonedPartialPath, 'half a database', 'utf8');

		await createDatabaseBackup({
			database,
			backupDirectory,
			temporaryDirectory: storageDirectory
		});

		expect(existsSync(abandonedPartialPath)).toBe(false);
		expect(await readBackupFileNames(backupDirectory)).toHaveLength(1);
	});

	test('fails without leaving a partial copy when the backup folder cannot be written', async() => {
		const storageDirectory = makeTempDirectory();
		const backupDirectory = path.join(makeTempDirectory(), 'blocked');
		writeFileSync(backupDirectory, 'not a folder', 'utf8');
		const database = openTrackedDatabase(storageDirectory);

		await expect(createDatabaseBackup({
			database,
			backupDirectory,
			temporaryDirectory: storageDirectory
		})).rejects.toThrow();

		expect(existsSync(path.join(storageDirectory, BACKUP_CONFIG.temporaryFileName))).toBe(false);
	});
});
