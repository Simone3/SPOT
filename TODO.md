
# wire in react state
state
	dates
		global with context
		---
		timeout at midnight + 1 second -> nodejs side, see also node-cron maybe
		this should also refresh tasks! e.g. move to due soon sublist -> trigger first load but with current filters
	tasks
		filters + list + form status in TasksPage
		form inputs in TaskFormModal
		---
		first load
			input
				raw list of tasks
			output
				5 lists of all tasks: urgent & due soon [also considers the next working day], high, medium, low, completed
					urgent&ds: sorted by priority desc, due date desc, creation date asc
					high/medium/low: sorted by due date desc, creation date asc
					completed: sorted by completion date desc
				5 lists of visible tasks
					like above
				4 lists of active+completed domains for filters (completed on): owners, priorities, tags, due dates
					owners, tags: sorted alphabetically
					priorities: sorted by value (not necessarily ALL priorities)
					due dates: sorted by date
				4 lists of active domains for filters (completed off): owners, priorities, tags, due dates
					like above
				3 lists of all domains for input fields: owners, priorities (constant), tags
					owners, tags: sorted by count desc
					priorities: sorted by value
				6 values for default filters
			logic
				build default filters
				for each task
					get correct task arrays based on status/priority
					push to full array
					if matches default filters
						push to visible array
					add or update counter for owner, priority, tags, due date in all domains for filters
					add or update counter for owners, tags in all domains for inputs
					if active
						add or update counter for owner, priority, tags, due date in active domains for filters
				sort all arrays
				set new arrays to state
		change filter (single or reset to default)
			input
				new filter values
			output
				updated lists of tasks
				updated filter values
				updated filter domains (if show completed changes)
			logic
				update filters object
				if show completed changed
					switch domains between active and active+completed
				for each list of tasks
					if filters completely remove the whole list (e.g. completed), exit
					reset empty list
					for each task
						if matches filters
							push to visible array
		save new task
			input
				new task
			output
				updated lists of tasks
				updated filter domains (if new values)
			logic
				(in the form?) validate/transform data: trim, empty strings, format date, tags (remove empty + check unique), etc.
				create and set new uuid
				[same logic of an iteration of first load]
				sort arrays (not all but 1-2 tasks and any domains changed - re-sort all for simplicity?)
				set form status as closed
				clear form inputs
		delete task
			input
				task id
			output
				updated lists of tasks
				updated filter domains (if only value)
			logic
				get correct task arrays based on status/priority
				remove from full array
				if was active
					remove from visible array
				delete or update counter for owner, priority, tags, due date in all domains for filters
				delete or update counter for owners, tags in all domains for inputs
				if was active
					add or update counter for owner, priority, tags, due date in active domains for filters
				sort arrays (not all but 1-2 tasks and any domains changed - re-sort all for simplicity?)
		update task
			input
				new task
			output
				updated lists of tasks
				updated filter domains (if changed)
			logic
				[same logic of an iteration of delete]
				[same logic of an iteration of first load]
				sort arrays (not all but 2-4 tasks and any domains changed - re-sort all for simplicity?)
				set form status as closed
				clear form inputs
		complete task
			[same as updating, without the form clear]
		open/close form
			input
				(nothing)
			output
				updated form status
			logic
				set form status as closed
				set form inputs

# wire in electron main process: save to disk
sqllite?
how often?
async
error handling
	notify when any error occurs
	mark tasks in error graphically?
	allow to retry the action from the notification?
	or suggest to try to submit form again (careful if form submits only changed data though!)?
allow to reload from disk with a button in settings
optional logging to filesystem

# others
change font
final ui polish inside electron
handle/block two instances or windows of the app at the same time?
test mode that allows to set mocked state from a button? e.g. special cases, thousands of rows, etc.
delayed text search input submit
focus (tab) on all icons (e.g. edit button)
scrollbar style?
check browser console errors
check spaces vs. tabs
check linter
select options and modal conflict when at the bottom of the content - also the entire content gets longer
change inputs, buttons and clickables on hover (e.g. change font to white?)
show notification popups
	"back-end" error
	save task
		task created
		task updated
		task completed
		empty task discarded

# notes
filters with all tags
also "uncategorized" option
filter by date
text search
sorted by date (with a section for each day?)

# maybe in the future
tag page that allows to set colors, add search keywords for each tag, merge tags, delete tags, etc.
timeline section for events with dates
localization
sorting in tasks and notes
shortcuts like ctrl+f
light theme
global search for both tasks and notes
drag&drop from outlook
search by keyword split + quotes for exact match
undo / history / redo
customize working days
change default filters
change default priority (task creation)
limit total filter chips + way to filter them if many values
counters in filters (currently shown and total) - are they actually useful?
tab to indent inside textareas
simple format in textareas? MD-like?
icons inside input fields and buttons
responsive for half-screen format (e.g. move filters on top?)
date picker with "free" text input like https://www.npmjs.com/package/native-datepicker
	write "today", "tomorrow", etc.?
	write dates in "any" format like 03/03/2024, 03-03-2024, etc.?
		new Date already does most of this, but how to "handle" locale?
	write just day and month and year is assumed to be current (or next) year
	also style date picker popup calendar 
		cannot do it in native date picker? build/import a custom one?
fix tab/focus on all inputs (also: you can focus on inputs under the add task modal!)
better accessibility (e.g. label + ID) for ButtonsSelect - maybe use the default <select> input styled as buttons?
better task add/edit
	completely replace form with inline edit/add?
		main problem: click outside "conflicts" with select, tried to make a global queue but gave up, maybe try again, see backup files and notes -> maybe reuse new form logic (clickOutsideClicksCounterRef and clickOutsideOpenCounterRef)
		the UX wasn't that great anyway, but maybe it can be improved
	always in editing mode?
		performance?
		how to handle empty chips?
		just for the task text?
			this could also be done for task creation: just the text and a button to open the full form for more customization?
	edit on hover?
		same as above
	leave form but also add quick-edit
		double click on text to show textarea, double click on owner to show popup with select, etc.
		no problem here with click-outside because single field
	add ctrl+s to save?
avoid many past due dates when show completed = true with just an "overdue" option?



























































