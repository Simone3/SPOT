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

	// The application menu. Every entry of the native menu is built from an Electron role, which is worded and translated by Electron
	// itself in the language the operating system runs in, so only the two submenu titles that have no role to take a title from are
	// needed for it. Everything else here is for the menu bar SPOT draws itself on Windows, where nothing is worded for it.
	menu: {
		file: 'File',
		edit: 'Edit',
		view: 'View',
		window: 'Window',

		// Names the whole drawn menu bar for anything reading the window out, which sees a row of buttons and nothing saying what they are
		bar: 'Application menu',

		exit: 'Exit',
		undo: 'Undo',
		redo: 'Redo',
		cut: 'Cut',
		copy: 'Copy',
		paste: 'Paste',
		selectAll: 'Select All',
		resetZoom: 'Actual Size',
		zoomIn: 'Zoom In',
		zoomOut: 'Zoom Out',
		toggleFullScreen: 'Toggle Full Screen',
		minimize: 'Minimize',
		close: 'Close'
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

		// Shown once the main process has answered, so that what put the window in this state can still be looked into afterwards
		logLocation: 'The error was written to the SPOT log file, {logFilePath}.',
		unknownLogLocation: 'The error could not be written to the SPOT log file.',

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

		// The entries the domain lists carry beyond the values the tasks themselves name
		domains: {
			noOwner: 'Me',
			noDueDate: 'None',
			noTags: 'Untagged',

			// What names a filter option carrying a count: the number beside the label is read as a figure, and this is what says what it counts
			withTaskCount: {
				one: '{label}, {count} task',
				other: '{label}, {count} tasks'
			}
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
		report: '{details}. {trailer}',
		trailer: 'Nothing on screen is lost, but those tasks may come back differently the next time SPOT starts. {logLocation}',

		// The notice says how much drifted, so it points at the log file, which holds the tasks and the fields behind it
		logLocation: 'SPOT wrote which tasks and which fields to its log file, {logFilePath}.',
		unknownLogLocation: 'SPOT could not write which tasks and which fields to its log file.',

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
		folderTitle: 'Backup folder',
		folderDescription: 'SPOT writes complete copies of the database here. SPOT never reads these copies back and it does not keep two computers in sync. To restore a backup manually, close SPOT and copy the backup you want over the database above under that exact name.',
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

		countTitle: 'Copies to keep',
		countLabel: 'Number of copies',

		// What the chosen number actually means, which is one of three things: nothing at all, the up-to-date copy alone, or that
		// copy and however many dated ones are left over. The plural counts the dated copies and so is never reached with none.
		countNone: 'No backup copies are written at all. Your tasks are still saved in the database above.',
		countLatestOnly: 'Only one backup, written a couple of minutes after you stop making changes.',
		countHelp: {
			one: 'One backup written a couple of minutes after you stop making changes and one other dated backup written after twelve hours of work.',
			other: 'One backup written a couple of minutes after you stop making changes and {count} other dated backups written after twelve hours of work.'
		},

		countChanged: {
			one: 'SPOT now keeps one backup copy.',
			other: 'SPOT now keeps {count} backup copies.'
		},
		countChangedToNone: 'SPOT no longer writes backup copies.',
		countChangeFailed: 'The number of backup copies could not be changed.',
		changingCount: 'Changing the number of backup copies...',

		status: {
			failed: 'The last backup could not be written. Your tasks are still saved.',
			failedWithMessage: 'The last backup could not be written. Your tasks are still saved. {message}',
			idle: 'No backup copy has been written yet. The next one follows your next task change.',
			latestCopy: 'The up-to-date copy was written on {timestamp}.',
			lastArchive: 'The most recent dated copy was written on {timestamp}.',
			noArchiveYet: 'No dated copy has been written yet.'
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
