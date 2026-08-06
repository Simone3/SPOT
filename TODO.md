

# current


## ui

manually adjust filter pane length / collapse entirely

priority icons in the filters?

ui feedback when clicking a button
change inputs, buttons and clickables on hover (e.g. change font to white?)

don't render dropboxes and hide them with css, just don't create them unless open = true!

fix focus on all components for consistency
	calendar, selectbox, etc.
	delete icon not focusable (all clickables probably)
	think about on-hover inputs, those are not focusable
	grey box-shadow on focus maybe?
	tabs behaviour too
	focus (tab) on all icons (e.g. edit button)
	click on chip icon auto-focuses on input

improve autocomplete
	bold the REMAINING part (not the substring that matches!) -> like amazon
	sort options by count desc
	show only the first N matches (no scrollbar)

scrollbar style?


## finalize

re-review all files created/modified after "Add hover feedback" commit (jun 2)

finalize first version, check if anything important is missing, close up documentation (e.g. near-term work, current status, etc.)

complete full tests on real build, on windows too!


------------------------------------------------------------------------------------------------------


# maybe in the future


## ui

date picker with "free" text input like https://www.npmjs.com/package/native-datepicker
	better date picker where you can insert dates in any format and/or that displays the formatted (today, tomorrow, etc.) value
	write "today", "tomorrow", etc.?
	write dates in "any" format like 03/03/2024, 03-03-2024, etc.?
		new Date already does most of this, but how to "handle" locale?
	write just day and month and year is assumed to be current (or next) year
	also style date picker popup calendar 
		cannot do it in native date picker? build/import a custom one?

animations when task list changes

light theme

limit total filter chips + expand + way to filter them if many values

responsive for half-screen format (e.g. move filters on top?)

better accessibility (e.g. label + ID) for ButtonsSelect - maybe use the default <select> input styled as buttons?


## logic

allow to reload from disk with a button in settings

timeline section for events with dates

shortcuts like ctrl+f (autofocus on search filter)

drag&drop from outlook

search by keyword split + quotes for exact match (or at least fix searching if spaces do not exactly match in the two strings)

undo / history / redo

working days should account for holidays (regional?) + customize working days (user)

let user change default filters
let user change default priority (task creation)

counters in filters (currently shown and total) - are they actually useful?

tab to indent inside textareas
simple format in textareas? MD-like?

avoid many past due dates in filters when show completed = true with just an "overdue" option?


## notes page

filters with all tags

also "uncategorized" option

filter by date

text search

sorted by date (with a section for each day?)

global search for both tasks and notes


## tags page

tag page that allows to set colors, add search keywords for each tag, merge tags, delete tags, etc.


## performance

completed task display plain text instead of inputs (in case of performance problems)

delayed text search input submit

moveInManuallySortedList removes and adds (splice twice)

updateTask always refreshes all domains even if none changed












