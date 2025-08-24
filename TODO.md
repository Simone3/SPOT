
# refactor

grey delete icon and refactor complete checkbox

edit
	add component for priority change
	add ui element for the timeout and final save? like a spinner (or whole border) that turns green at the end
	form: validate/transform data: trim, empty strings, remove double/weird spaces, format date, tags (remove empty + check unique), etc.
	show confirm popup on delete -> already implemented in modal
	disable spellcheck on textarea
refactor new task and remove modal component
	button that creates a new task with empty text and then everything is an update basically
	add task when filters active: add newTask boolean that makes it pass any filter and is reset on any change? something like that
list
	"No tasks to display" for both or neither section? or "add new task" is enough for first list?
	do "visibleTasks = tasks.filter((task) => task.visible)" inside state callbacks (visibleActiveTasks etc.) to avoid many filters / re-renders?
	completed strikethrough for datepicker not working
sort
	implement manual sort for active tasks -> careful with moving with an active filter and therefore a sub-list!
	button to auto-sort active tasks
		if priority is the same, keep original manual sort?
		do not recompute ALL positions but just those that do not match?
filters
	"me" and "none" filters displayed only if there are actually tasks with empty values?
	priority icons and/or colors in the filters?

# wire in electron main process: save to disk
sqllite?
how often?
async
debounce changes and merge changes on same element (text typing)
error handling
	notify when any error occurs
	mark tasks in error graphically?
	allow to retry the action from the notification?
	or suggest to try to submit form again (careful if form submits only changed data though!)?
allow to reload from disk with a button in settings
log to filesystem each change (with max lifetime/size)
batch update/insert events for multiple changes
	careful with "sortPosition" updates in ManuallySortedList...
move deleted tasks into another table?
add config that turns on a "coherence check" event (added to the event queue so that any concurrent changes are queued) that every hour or so compares in-memory with db?
does closing the program while typing save the latest value? considering both state update on blur and/or delayed disk save, if implemented

# others
don't render dropboxes and hide them with css, just don't create them unless open = true!
fix focus on all components for consistency
	calendar, selectbox, etc.
	delete icon not focusable (all clickables probably)
	think about on-hover inputs, those are not focusable
	grey box-shadow on focus maybe?
	tabs behaviour too
completed task display plain text instead of inputs (in case of performance problems)
better date picker where you can insert dates in any format and/or that displays the formatted (today, tomorrow, etc.) value
toggle filters sidebar visibility
unit test all logic files (tasks, filters, domains, etc.)
integration tests with web automation
	basic: add, edit, complete, delete, filter -> start with 0 tasks and end with 0 tasks
	change task and immediately change filter or exit tasks list, multiple tasks at once, delete and complete one while counter is running
	very long domain values; very long texts
	remove/complete task that is the only one that has the current active filter
	manually sort and trigger reload, manually sort in filtered list
	add multiple empty tasks
improve autocomplete
	bold the REMAINING part (not the substring that matches!) -> like amazon
	sort options by count desc
	show only the first N matches (no scrollbar)
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
feedback on click for buttons etc.
show notification popups
	"back-end" error
	save task
		task created
		task updated
		task completed
		empty task discarded
improve performance if needed
	moveInManuallySortedList removes and adds (splice twice)
	updateTask always refreshes all domains even if none changed

# notes
filters with all tags
also "uncategorized" option
filter by date
text search
sorted by date (with a section for each day?)

# maybe in the future
click on chip icon auto-focuses on input
animations when task list changes
lang / translations (define all strings in lang file)
tag page that allows to set colors, add search keywords for each tag, merge tags, delete tags, etc.
timeline section for events with dates
localization
sorting in tasks and notes
shortcuts like ctrl+f (autofocus on search filter)
light theme
global search for both tasks and notes
drag&drop from outlook
search by keyword split + quotes for exact match (or at least fix searching if spaces do not exactly match in the two strings)
undo / history / redo
working days should account for holidays (regional?) + customize working days (user)
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



























































