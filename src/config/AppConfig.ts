/**
 * App-wide configuration values.
 * Centralizes tunable constants (sizes, delays, retry policies, file and directory names) instead of spreading them as magic numbers across modules.
 * This file is shared by the Electron main process and the React renderer, so it must stay free of Node and Electron imports.
 */

export const WINDOW_CONFIG = {
	widthPixels: 800,
	heightPixels: 600,
	preloadScriptFileName: 'preload.js',
	reactBuildIndexPathSegments: [ 'build', 'index.html' ],

	// "npm start" sets this to the Vite development server it started, and the main process loads the renderer from there instead of
	// from disk. Every other run leaves it unset and loads the built "build/index.html".
	developmentServerUrlVariable: 'SPOT_DEVELOPMENT_SERVER_URL'
} as const;

export const TITLE_BAR_CONFIG = {

	// How tall the title bar SPOT draws is, and therefore how tall the native window buttons Electron overlays on it are. The renderer
	// reads the height back from the overlay instead of repeating this number, so this is the only place it is decided.
	heightPixels: 32,

	// The window buttons are drawn by the operating system, so their two colors are given to Electron rather than to CSS. They mirror
	// "--colors-background-primary" and "--colors-text-primary" in "src/index.css" and have to be changed with them.
	backgroundColor: '#212529',
	symbolColor: '#FFFFFF'
} as const;

export const ZOOM_CONFIG = {

	// One step of the zoom menu entries, in Chromium zoom levels: every level is 1.2 times the previous one
	stepLevel: 0.5,

	// How far the zoom entries go, which is roughly a third of the normal size and a little over twice it. Chromium clamps zoom itself,
	// but only far past the point where the application is unusable.
	minimumLevel: -5,
	maximumLevel: 5
} as const;

export const I18N_CONFIG = {
	// Used when the runtime asks for a language SPOT does not ship a bundle for. It must be one of the languages in "src/i18n/Translations.ts".
	defaultLanguage: 'en'
} as const;

export const STORAGE_CONFIG = {
	directoryName: 'storage',
	databaseFileName: 'spot.sqlite',
	currentSchemaVersion: 1,
	databaseTimeoutMs: 5000,
	writeRetryDelayMs: 5000,

	// A database error the retries cannot fix, such as a full disk, would otherwise keep the failed write at the front of the queue and leave
	// every later change unwritten for the rest of the session, so the retries are bounded and the change is then reported as lost
	maximumWriteAttempts: 5
} as const;

export const BACKUP_CONFIG = {
	directoryName: 'backups',
	filePrefix: 'spot-backup-',
	fileExtension: '.sqlite',
	partialFileExtension: '.part',
	temporaryFileName: 'spot-backup.tmp.sqlite',

	// The one copy that is kept up to date, overwritten in place. It carries the prefix and the extension of a dated copy but not a
	// timestamp, which is what keeps the rotation of the dated copies from ever counting it as one of them.
	latestFileName: 'spot-backup-latest.sqlite',

	// How long the changes have to have been quiet before the up-to-date copy is written again
	delayAfterChangeMs: 120000,

	// How much older than the newest dated copy the folder has to be before another one is taken. It is measured against the copies
	// in the folder rather than against the moment the application started, so a session that is opened and closed all day cannot
	// spend the whole rotation on one day of work.
	archiveIntervalMs: 12 * 60 * 60 * 1000,

	// How often that is checked. A single twelve-hour timer would be the obvious way to do it and the wrong one: a machine that
	// slept through the deadline fires it late and at an hour nothing chose, while a short check simply notices on the next tick.
	archiveCheckIntervalMs: 15 * 60 * 1000,

	// How many copies the folder keeps, counting the up-to-date one: 0 writes nothing at all, 1 writes only the up-to-date copy,
	// and anything more adds that many dated copies less one. The user chooses this in Settings, so these are the default and the
	// range the choice is held to rather than the value itself.
	defaultRetainedBackupCount: 10,
	minimumRetainedBackupCount: 0,
	maximumRetainedBackupCount: 50,

	// The quit runs the copies that are due, which is a snapshot, a publish and possibly a second copy and a prune, so the budget
	// covers all of them on a slow destination. A folder that stopped answering costs the quit this much and nothing more.
	shutdownTimeoutMs: 15000
} as const;

export const APP_CONFIG_FILE = {
	developmentDirectoryName: 'dev',
	fileName: 'spot-config.json'
} as const;

export const LOGGING_CONFIG = {
	directoryName: 'logs',
	fileName: 'spot-logs.ndjson',
	maximumFileSizeBytes: 100 * 1024 * 1024,
	retainedArchiveCount: 5
} as const;

export const TASKS_CONFIG = {
	flushDelayMs: 5000,
	stateChangeDelayMs: 3000,
	sortPositionStep: 1000,

	// How many days after tomorrow a due date is shown as a weekday name instead of a full date
	dueDateWeekdayHorizonDays: 5
} as const;

export const PANE_LAYOUT_CONFIG = {
	// Where the divider between the filters pane and the tasks pane sits when SPOT starts, as a share of the width the two panes share
	defaultFiltersPaneFraction: 1 / 3,

	// How much of that width one arrow key press moves the divider by
	keyboardStepFraction: 0.02,

	// How narrow a pane may get is measured from the headers it holds, so this is only the floor for a pane that holds none
	minimumPaneWidthPixels: 150
} as const;

export const AUDIT_CONFIG = {
	// Task updates are optimistic, so the task state can only be known to have reached the database by reading it back. This is a
	// first-period safety net meant to be switched off once the write path has been trusted for a while, not a part of that path.
	enabled: true,

	// The first audit lets the application settle instead of running right after the startup load, which nothing has written over yet
	initialDelayMs: 60000,
	intervalMs: 600000,

	// A report listing every task would be unreadable and would put the whole task list in the console, so the listed ones are capped
	maximumReportedTasks: 20
} as const;

export const DIAGNOSTICS_CONFIG = {
	// A render error is reported with the stack and the component stack the renderer hands over as they are, so the log line is
	// bounded here rather than trusting their length. Rotation bounds the file, but one entry still has to stay readable.
	maximumReportedTextLength: 4000
} as const;

export const SHUTDOWN_CONFIG = {
	// A write that failed can still be sitting on the retry delay when the flush handshake starts, and every retry that fails again schedules
	// the next one, so the wait has to cover the whole retry budget of one command and not just a single delay: the renderer cannot ask for
	// the retry sooner while it is waiting for the queue, so a shorter timeout gives up while the retry that saves the change has not run yet.
	// The queue gives a change up after that many attempts, so this is what a quit can be held for at worst, and only while writes keep failing.
	rendererFlushTimeoutMs: STORAGE_CONFIG.writeRetryDelayMs * STORAGE_CONFIG.maximumWriteAttempts + 3000,

	// The window stays interactive while the queued writes are drained, so the renderer flushes again to pick up what the user typed in the
	// meantime. The rounds are bounded, because someone who keeps typing must not be able to hold the quit open forever.
	maximumRendererFlushRounds: 3
} as const;
