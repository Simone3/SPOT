
# task list
empty owner = me
refactor sections so that the whole thing disappears if no elements in the list

# task filters
section titles
just ALL available options without selectboxes
	limit? 2 rows?
counters for each filter: total + currently displayed
	performance?
owner: "None (me)" + all others
priority
due date
text search
tags
completed flag
reset to default button
way to filter tags/owners/etc. if many values
click = select just that element; crl (or alt?) + click = add/remove to current selection
gray out values that have no match
	but they may still be selected (e.g. when changing other filters) -> selected vs. active are two different concepts

# add/edit task
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















































































