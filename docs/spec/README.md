# Specification

This is the specification of Wardrobe as it is on `main`. It states what the app does, not
how the work was planned. The code and its tests are the authority: when a rule here and the code
differ, one of the two has a defect.

The names of the screen are the English ones; `src/locales/es.js` is the source wording.

## Documents

| Document | Content |
|---|---|
| [01-engineering.md](01-engineering.md) | Modules, code rules, storage keys, tests and checks |
| [02-offline-version.md](02-offline-version.md) | Service worker, version, update toast, deploy, installation |
| [03-install.md](03-install.md) | The install offer and the Install button |
| [04-design-system.md](04-design-system.md) | Layers, tokens, components, icons, breakpoints and the catalogue |
| [05-layout.md](05-layout.md) | Size classes, navigation, sections, modules and the walkthrough |
| [06-i18n.md](06-i18n.md) | The languages and the rules of the text |
| [07-wardrobe.md](07-wardrobe.md) | The palette, the garments, the outfits and their sections |

## Rule identifiers

Each rule has an identifier, a prefix and a number, such as `GAR-3`. An identifier is stable: a
rule that goes away keeps its number, marked as removed, and a new rule gets the next number. Use
the identifier in a commit body or in a test name to point at a rule.

| Prefix | Document |
|---|---|
| `ENG` | 01-engineering |
| `SW`, `VER` | 02-offline-version |
| `INS` | 03-install |
| `DS` | 04-design-system |
| `LAY`, `NAV`, `MOD`, `ONB` | 05-layout |
| `I18N` | 06-i18n |
| `PAL`, `GAR`, `OUT`, `WAR` | 07-wardrobe |

## Words

| Word | Meaning |
|---|---|
| Shell | The files that the service worker keeps for offline use: `SHELL` of `sw.js` |
| Deploy | A release tag `vX.Y.Z` that GitHub Pages publishes |
| Size class | compact (below 600px), medium (600px to 839px) or expanded (840px and up) |
| Section | One of the screens of the navigation: Wardrobe and Settings |
| Module | A part of the app that Settings turns off, with its sections |
| Pane | The list and the detail of one entry, side by side in the expanded class |
| Sheet | A panel that comes up from the bottom of the screen |
| Message | An error or a notice as `{ key, params }`, which the screen turns into text |
| Doc | The stored state of the app: one JSON value under one storage key |

## Upkeep

A change of behaviour changes the rule here in the same commit as the code. A new feature adds its
rules to the document of its area, or adds a document and a row in the tables above.

`tests/spec.test.js` and `.githooks/pre-commit` enforce this; see the rules ENG-12 to ENG-15 in
[01-engineering.md](01-engineering.md).
