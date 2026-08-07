import type { TranslationTree } from 'src/framework/types/TranslationTypes';

/**
 * Every word SPOT shows the user, in English.
 * This bundle is the source of truth for the key type, so a key added here has to be translated in every other language
 * before that language compiles, and a key renamed here stops compiling everywhere it is used.
 *
 * It is imported by the Electron main process as well as the renderer, so it must stay free of Node, Electron and React imports.
 */
export const EN_TRANSLATIONS = {
	sidebar: {
		tasks: 'Tasks',
		notes: 'Notes',
		tags: 'Tags',
		settings: 'Settings'
	},

	// Names for the days around today. The framework decides which day a date falls on, so these only name the ones SPOT calls out.
	dates: {
		today: 'Today',
		yesterday: 'Yesterday',
		tomorrow: 'Tomorrow'
	},

	pages: {
		notesWorkInProgress: 'Notes: work in progress',
		tagsWorkInProgress: 'Tags: work in progress'
	},

	// What a failure nothing else caught tells the user. It never promises more than the database holds: what the user was typing
	// when it happened may not have been saved.
	crash: {

		// Shown in place of the whole application when a render error left nothing else to show
		title: 'SPOT ran into an unexpected error',
		message: 'The page could not be shown. Your tasks are kept in the database, so reloading brings back everything that was saved.',
		reload: 'Reload SPOT',

		// Shown as a native error box, because a main process failure may leave no window to show anything in
		mainProcessTitle: 'SPOT ran into an unexpected error',
		mainProcessMessage: 'The error was written to the SPOT log file. Your tasks are kept in the database and were not changed by it.\n\nDetails: {message}'
	},

	tasks: {
		loading: 'Loading tasks...',
		activeListTitle: 'Tasks',
		completedListTitle: 'Completed Tasks',
		emptyList: 'No task found! Change the current filters or create new tasks.',

		actions: {
			refresh: 'Refresh',
			sortByImportance: 'Sort by importance',
			add: 'Add task',
			drag: 'Drag task',
			delete: 'Delete task'
		},

		fields: {
			contentPlaceholder: 'Add content...',
			ownerPlaceholder: 'Me',
			dueDatePlaceholder: 'No due date',
			tagPlaceholder: 'Add tag...'
		},

		delete: {
			title: 'Delete task?',
			permanentWarning: 'This will permanently delete this task.',
			irreversibleWarning: 'This action cannot be undone.',
			confirm: 'Delete Task',
			cancel: 'Keep Task'
		},

		// Shown in the priority picker and the priority filter. The stored task value is a separate constant, so translating these never touches the database.
		priorities: {
			urgent: 'Urgent',
			high: 'High',
			normal: 'Normal',
			low: 'Low'
		},

		// The entries the domain lists always carry, whether or not a task uses them
		domains: {
			noOwner: 'Me',
			noDueDate: 'None'
		}
	},

	filters: {
		title: 'Filters',
		reset: 'Reset to default',
		resizePane: 'Resize the filters pane',
		content: 'Content',
		contentPlaceholder: 'Search...',
		priorities: 'Priorities',
		owners: 'Owners',
		dueDates: 'Due dates',
		tags: 'Tags',
		showCompleted: 'Show completed'
	},

	storage: {
		electronOnly: 'SPOT must be opened from the Electron app.',
		startupErrorTitle: 'Task storage is unavailable',
		unsavedChangesTitle: 'Tasks are not saved',
		needsAttentionTitle: 'Task storage needs attention',
		backupFailedTitle: 'Backup copies are not being written',
		backupFailedMessage: 'Your tasks are saved, but SPOT could not write a backup copy to the backup folder. You can check the folder in Settings.',
		databaseStatus: 'Database status: {state}.',
		databaseStatusWithMessage: 'Database status: {state}. {message}',

		// Keyed by the database health value, so the state a status carries maps straight onto its wording
		databaseStates: {
			'not-configured': 'not configured',
			healthy: 'healthy',
			unavailable: 'unavailable'
		},

		updateFailed: 'Task storage update failed. {message}',
		updateAbandoned: 'Task storage update failed {attempts} times and was given up on, so that change is not stored. {message}',
		closed: 'Task storage is closed.',
		shuttingDown: 'Task storage is shutting down.'
	},

	// The audit only reads, so its wording stays a notice: what it found is never a reason to distrust what is on screen
	audit: {
		driftTitle: 'Tasks on screen and stored tasks differ',
		logMessage: 'The tasks on screen and the tasks in the database are not the same',
		report: '{details}. {trailer}',
		trailer: 'Nothing on screen is lost, but those tasks may come back differently the next time SPOT starts. The details are in the developer console.',

		// Used when there were more differences than the report lists, so they cannot be broken down by reason
		cappedDetails: {
			one: '{count} task on screen does not match what SPOT has stored',
			other: '{count} tasks on screen do not match what SPOT has stored'
		},

		details: {
			missingInDatabase: {
				one: '{count} task not stored yet',
				other: '{count} tasks not stored yet'
			},
			missingInState: {
				one: '{count} task stored but not shown',
				other: '{count} tasks stored but not shown'
			},
			differentValues: {
				one: '{count} task stored with different values',
				other: '{count} tasks stored with different values'
			}
		}
	},

	// Which build is running, so that two installed copies can be told apart
	appInfo: {
		title: 'About',
		version: 'SPOT version {version}',
		unknownVersion: 'The SPOT version is unknown.'
	},

	backup: {
		databaseTitle: 'Task database',
		databaseDescription: 'SPOT keeps all your tasks in a single spot.sqlite database inside its own application folder. This is always where your tasks are read from and written to, and it cannot be moved.',
		unknownDatabasePath: 'Unknown.',

		// Restoring is a manual step by design: SPOT never reads a backup copy back on its own, so the one way to use one has to be written down
		restoreTitle: 'Restoring a backup',
		restoreDescription: 'Quit SPOT first, so it is not writing to the database. Then copy a file out of the backup folder over the database file above, keeping that exact name, and start SPOT again. The copy replaces everything: any task change made after that backup was written is gone, so it is worth keeping the current database somewhere else before overwriting it.',

		folderTitle: 'Backup folder',
		folderDescription: 'A complete copy of the database is written here a couple of minutes after you stop making changes, and once more when SPOT closes. The {retainedBackupCount} most recent copies are kept and the older ones are removed.',
		folderWarning: 'This folder is a backup destination, not a shared one. A folder synchronized by OneDrive, Google Drive, Dropbox or iCloud is safe to use, because each copy is written as one finished file. SPOT never reads these copies back though: it does not keep two computers in sync, and restoring a backup is a manual step.',
		noFolderSelected: 'No folder is selected.',
		developmentNotice: 'Development run: the backup folder can be changed to test the app, but the next development startup goes back to the development folder.',

		changeFolder: 'Change folder...',
		useDefaultFolder: 'Use default folder',
		changingFolder: 'Changing the backup folder...',
		folderUnusable: 'The selected folder cannot be used.',
		folderAlreadyInUse: 'The selected folder is already in use.',
		defaultFolderAlreadyInUse: 'The default folder is already in use.',
		folderChanged: 'Backup copies are now written to "{directory}".',
		folderChangeFailed: 'The backup folder could not be changed.',

		confirm: {
			title: 'Change the backup folder?',
			currentFolder: 'Current folder: {directory}',
			newFolder: 'New folder: {directory}',
			copiesStay: 'The copies already written to the current folder are left where they are.',
			tasksStay: 'Your tasks are not moved: they stay in the database in the SPOT application folder.',
			confirm: 'Change folder',
			cancel: 'Cancel'
		},

		status: {
			failed: 'The last backup could not be written. Your tasks are still saved.',
			failedWithMessage: 'The last backup could not be written. Your tasks are still saved. {message}',
			idle: 'No backup copy has been written yet. The next one follows your next task change.',
			lastWritten: 'Last backup copy written on {timestamp}.'
		},

		// Why a folder the user picked, or one saved from a previous run, cannot be used
		directory: {
			noneSelected: 'No backup folder is selected.',
			missing: 'The backup folder "{directory}" does not exist. It may have been deleted, renamed, or it may be on a drive that is not currently available.',
			notADirectory: 'The backup path "{directory}" is not a folder.',
			unusable: 'The backup folder "{directory}" cannot be read and written.'
		},

		// The wording of the native folder dialog, which the Electron main process opens
		dialog: {
			title: 'Choose the SPOT backup folder',
			message: 'Choose the folder where SPOT writes backup copies of the task database.',
			buttonLabel: 'Use this folder'
		}
	}
} as const satisfies TranslationTree;
