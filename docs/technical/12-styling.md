# §12 — Styling

*[Index](README.md) · [← §11 The interface](11-interface.md)*

---

## 12.1 Plain CSS, one file per component

No CSS framework, no CSS-in-JS, no preprocessor. A component that needs styles has a `.css` file of the same name beside it and imports it at the top of its module, through the absolute `src/...` prefix like every other import ([§3.3](03-build-and-run.md#33-two-bundles-two-bundlers)). Vite collects those imports into one stylesheet at build time.

`src/index.css` is the only global stylesheet: the layout, the theme variables and the focus ring.

## 12.2 The theme

**The current visual direction is dark, direct and utilitarian.** The variables in `src/index.css` cover:

- background colors
- border, overlay and shadow colors
- interaction hover and active colors
- text colors
- accent colors
- priority colors
- danger variants, warning and disabled colors
- the Inter font family
- the focus ring

**Two of those colors exist twice on purpose.** `TITLE_BAR_CONFIG` in `AppConfig` mirrors `--colors-background-primary` and `--colors-text-primary`, because the window buttons Electron overlays on the drawn title bar are painted by the operating system and never reach CSS ([§10.2](10-application-menu.md#102-the-menu-bar-spot-draws-itself)). The two have to be changed together.

## 12.3 The focus ring

**Every focusable control draws the same ring and none of them draws the one the browser would draw.** `src/index.css` holds it as the `--focus-ring` variable and applies it to `:focus-visible` for the whole application, so a control needs no focus rule of its own:

- **The ring is a `box-shadow` and not an `outline`**, so that it follows whatever shape the control already has, whether or not the control has a border. That is what lets a bordered button, a borderless chip input and a checkbox all light up the same way.
- **It is drawn on `:focus-visible` rather than `:focus`**, so a control lights up when the keyboard reaches it and stays quiet when the pointer clicks it. A text entry field matches `:focus-visible` on a click too, which is why a field the user is about to type into does light up on a click.
- **A dark hairline separates the accent ring from what it surrounds**, so the ring is visible even on a control filled with the accent color, such as a selected `ButtonsSelect` option or the selected day in the date picker.

Three things follow from a single ring for everything:

- **A control that draws its own focus UI has to override the shared rule and say why.** `PaneDivider` is the only one: it moves the ring onto the line it draws, because a ring around its whole grab area would be a glowing column running down the page. The entries of the drawn menu bar are the one place with no ring at all, because they never take the focus ([§11.4](11-interface.md#114-common-components)).
- **A control the ring would be clipped on gets the room it needs from whatever clips it**: the free-select dropdown insets its option list, and the priority picker carries horizontal padding. The picker is centered on the task border, so that padding grows it symmetrically and leaves its gradient where it is.
- **A control with no room around its own content stands the ring off from it.** `TextArea` is the one that needs it, because MDXEditor fills the editable area with the text: the ring is drawn by the container on a pseudo-element inset outwards from it, which stands off from the text without moving anything else on the task card.

**Anything clickable is a real control and not a clickable `div`**, so that the keyboard reaches it, activates it and shows the ring on it. `Clickable` is where that is enforced for the controls that are only an icon.

---

[← §11 The interface](11-interface.md) · [§13 Testing →](13-testing.md)
