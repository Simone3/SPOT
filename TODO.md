
# new state logic

load raw
	create task object
		sortPosition from saved value
	add to activeTasks or completedTasks
		compute visibility based on current filters
	add/update priorities domains
	add/update owners domains
	add/update due dates domains
	add/update tags domains
	sort all lists
	
add task
	same as load raw
		except: sortPosition = 1st sort position - X
		except: no need to sort tasks

delete task
	remove from activeTasks or completedTasks
	remove/update priorities domains
	remove/update owners domains
	remove/update due dates domains
	remove/update tags domains
	NO need to sort

update task
	same as delete (old)
	same as add (new)
		this must be a different object

change filter
	change current filters
	loop activeTasks and completedTasks to update visibility
		if visibility changes, the object needs to be cloned

complete task
	same as update

move active task (sort)
	update activeTasks
	if next.sortPosition - prev.sortPosition <= 1
		reload ALL sortPositions of activeTasks (start from 0 and then +X)
	else
		this.sortPosition = prev.sortPosition + round((next.sortPosition - prev.sortPosition) / 2)

reset sort
	sort activeTasks (with custom sort function!)
	reload ALL sortPosition of activeTasks (start from 0 and then +X)

# refactor
2 lists: active and completed
manual sort (active) + fixed sort (completed)
button to auto-sort active tasks
	if priority is the same, keep original manual sort!
edit in place only (only for active tasks?)
	textarea for text
		same as text?
		auto-fit height and width?
	on hover
		show chip placeholders
		show actions (left?): move (drag&drop + arrows?), edit priority (slider? arrows?), complete, delete?
form: validate/transform data: trim, empty strings, remove double/weird spaces, format date, tags (remove empty + check unique), etc.

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
search by keyword split + quotes for exact match (or at least fix searching if spaces do not exactly match in the two strings)
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



























































