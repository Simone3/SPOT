
# add/edit task
final form ui
save only if content valid
delete button -> only edit -> with confirm popup!
wire in initial task
title add vs edit
better tags input (form) where it suggests existing tags (most used first) - ButtonsSelect-like -> N different ButtonsSelect with a button "add tag" -> any empty or duplicate input gets ignored at submit

# task filters
reset to default button
dont show filters if no tasks, leave just text search

# task list
always display owner chip?
h3 margin, align with filters

# wire in react state
reducer + context?
split current tasks from completed? split by sections (i.e. by priority)?
sort tasks (completed by completion date desc, others by priority / add date / what?)
"soon" also considers the next working day
how to split urgent vs. soon? if an urgent task is due today where does it go?
	merge the two sections? -> single "top priority" section?
	"immediate" and "due soon" (all immediate go on top, due soon just contains high/normal/low)
current day as state so that everythibg updates at midnight (friendly day names, due soon tasks, etc.)
filters should, on the same pass, update both task list and current filter counters
add/delete/complete/edit task should update filters
show completed should update filters (add many more tags, due dates, etc.)
	or should it?
	avoid many past due dates with just an "overdue" option?
uuid created by FE?
owners in select inputs should be ALL ever used (completed too!) ordered by frequency / last use
	a newly added one should be on top even if just 1 use?
	limit total values to top 10 or something?
	something like first 7 are most used ones desc and last 3 the most recent ones?
	remove values that have not been used in a long time?
	be careful when filtering options: should this display ALL values? so maybe better to put all with count desc

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

# notes
filters with all tags
also "uncategorized" option
filter by date
text search
sorted by date (with a section for each day?)

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
change inputs on hover (e.g. change font to white?)

# maybe in the future
tag page that allows to set colors, add search keywords for each tag, merge tags, delete tags, etc.
localization
sorting in tasks and notes
shortcuts like ctrl+f
light theme
global search for both tasks and notes
timeline section for events with dates
drag&drop from outlook
search by keyword split + quotes for exact match
undo / history / redo
customize working days
change default filters
change default priority (task creation)
limit total filter chips + way to filter them if many values
counters in filters (currently shown and total) - are they actually useful?
in-place task form (both edit and update), i.e. merge Task and TaskForm
	how to save?
		click outside effect just for form (conditional effects are not allowed though)
	or always-edit form? how to handle empty chips?
	edit on hover? same as above
tab to intent inside textareas
icons inside input fields and buttons
responsive for half-screen format (e.g. move filters on top?)
date picker with "free" text input like https://www.npmjs.com/package/native-datepicker
	write "today", "tomorrow", etc.?
	write dates in "any" format like 03/03/2024, 03-03-2024, etc.?
		new Date already does most of this, but how to "handle" locale?
	write just day and month and year is assumed to be current (or next) year
style date picker popup calendar 
	cannot do it in native date picker? build/import a custom one?
fix tab/focus on all inputs (also: you can focus on inputs under the add task modal!)
better accessibility (e.g. label + ID) for ButtonsSelect - maybe use the default <select> input styled as buttons?



































































