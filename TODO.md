
# task filters
reset to default button

# add/edit task
pencil button cursor pointer
complete and edit buttons are too close?
in place (list)
	how and where to put add new?
dotted chips for empty values
add chip for priority too (no empty value allowed)
owner: empty = me
directly a text/search input inside chips?
	for tags most used suggestions, add only if not already there
	no select boxes but multiple buttons?
uuid created by FE?
click outside form?
during-edit buttons
	complete (temp inside form)
	delete
	confirm
	discard
date picker
tag ID is the text itself?

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

# wire in electron main process: save to disk
sqllite?
how often?
async

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













































































