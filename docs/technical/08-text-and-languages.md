# §8 — Text and languages

*[Index](README.md) · [← §7 The task write path](07-task-write-path.md)*

---

## 8.1 One bundle, and why there is still a translator

Every word SPOT shows the user lives in a translation bundle under `src/i18n/lang`. Only English ships today, and there is no language picker yet, but the whole path a language takes is in place: the requirement is not that SPOT is translated, it is that a second language must not be a rewrite.

**The framework owns the mechanism and the application owns the words:**

| File | Role |
| --- | --- |
| `src/framework/i18n/Translator.ts` | Creates a translator over one bundle: it resolves a dotted key, replaces `{name}` placeholders, picks a plural form, formats interpolated numbers and joins lists |
| `src/i18n/lang/en.ts` | The bundle. Exported `as const satisfies TranslationTree`, which is what makes English the source of truth for the key type: `t('tasks.filters.title')` autocompletes, a key that does not exist does not compile, and a key renamed in the bundle stops compiling everywhere it is used |
| `src/i18n/Translations.ts` | Maps a language to its bundle and creates the translator. Its `TRANSLATION_BUNDLES` values are typed as the English bundle, so a second language that is missing a key is a compile error rather than a key appearing on screen. It holds no React and no Electron, because the main process imports it too |
| `src/i18n/TranslationContext.tsx` | The renderer binding: `TranslationProvider` and the `useTranslator()` hook |

**A second language is added by writing its bundle next to `lang/en.ts` and listing it in `TRANSLATION_BUNDLES`.** Nothing else has to change.

## 8.2 Plurals, numbers and lists

**Plural forms are not a count compared against 1.** A leaf may be an object of plural categories instead of a string, and the category is picked by `Intl.PluralRules` from the `count` parameter, because the categories a language has and which counts fall into them are not the same from one language to the next: Polish puts 1, 3 and 5 into three different categories that English does not have.

**Interpolated numbers are formatted with `Intl.NumberFormat`** in the translator's locale rather than pasted in, so grouping follows the locale. Lists of already translated fragments are joined with `translator.formatList()`, which uses `Intl.ListFormat` with `type: 'unit'`: a plain enumeration, with the locale's separator and without a trailing conjunction. The task state audit is what uses all three at once.

**No library is used for any of this.** Electron ships V8 with full ICU, so `Intl` already holds the rules; what a library would add over the roughly two hundred lines here is ICU MessageFormat, runtime bundle loading and a translator-facing workflow, none of which SPOT needs yet. What it would not add is the typed keys, which are the part that actually pays for itself at this size.

## 8.3 Reaching the translator

- **Components** call `useTranslator()`. `TranslationProvider` is mounted at the very top of `src/index.tsx`, above the two state contexts, because both of them word messages too.
- **Pure logic** takes what it needs as a parameter, the same way `DateUtils` takes its date labels. `createTaskStateAuditMessage()` takes the translator; `getInitialDomains()` takes only the six labels it needs, as a `DomainLabels` object, so the domain logic stays free of translation itself.
- **The renderer write queue** is created before anything mounts and words its failures whenever one happens, so it is told the language instead of asking for it: `setTaskStorageQueueTranslator()` is called from `TasksContext` when the translator changes.
- **The Electron main process** creates its own translator in `src/main/Main.ts` from `app.getLocale()`, resolved through the same `resolveSpotLanguage()` the renderer uses on `navigator.languages`. It words the native folder dialog, the message a command gets once shutdown started refusing them, the message a command gets after the database is closed, the reasons a backup folder cannot be used, and the two application menu titles that have no Electron role to take a title from. **This is why `src/i18n/Translations.ts` and the bundles must stay free of React and Electron**, exactly like `AppConfig`.

## 8.4 What is not translated

**Developer-facing strings** stay where they are and stay in English: log messages, `console` output, and the messages of errors only a bug can raise, such as a task field mapped to an immutable column. Translating a bug report helps nobody.

**The application menu entries built from an Electron role** are not in the bundle either, but for the opposite reason: Electron words and translates them itself, in the language the operating system runs in, which is further than a bundle SPOT ships only in English reaches ([§10.1](10-application-menu.md#101-the-native-menu)).

**The stored task values.** A priority stores `URGENT` and only its label is worded, so changing the language never touches the database.

## 8.5 Changing language at runtime

`TranslationProvider` holds the language in state and rebuilds the translator when it changes, so everything below it re-renders in the new language. `useLanguage()` exposes the current language and the setter a picker would use. **Nothing calls the setter yet.**

Two things are deliberately not re-worded when the language changes: messages already produced by the write queue, which describe something that happened at the time, and the labels of domain entries that came from what the user typed, which were never translated to begin with.

---

[← §7 The task write path](07-task-write-path.md) · [§9 Tasks →](09-tasks.md)
