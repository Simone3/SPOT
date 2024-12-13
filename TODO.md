
# task filters
section titles
	handle empty sections
just ALL available options without selectboxes
counters for each filter: total + currently displayed -> "Text (4 of 7)"
filters
	text search
	priority
	owner: "Me" + all others
	due date
	tags
	show completed
	---
	text input
	checkbox input
	single/multiple select with chips and counters
reset to default button
click = select just that element; crl + click = add/remove to current selection
gray out values that have no match
	active -> blue background, standard font/border
	active greyed out (0) -> blue(ish?) background, grey font/border (?)
	selectable -> standard background and font/border
	selectable greyed out (0) -> standard background, grey font/border

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













































































