# Wardrobe

Load my clothes and generate outfits. An offline Android PWA in plain HTML, CSS and ES modules:
no build step and no dependencies. Scaffolded from `pwa-template`, it has:

- an offline service worker, an update check with an update toast, and an install button;
- an adaptive layout: a bottom bar on a phone, a rail on a tablet, list and detail side by side
  on a wide screen;
- a design system with a live catalogue at `/designs/`;
- English and Spanish text, light and dark themes, a left-hand mode;
- a release script and a GitHub Pages deploy on a version tag;
- structural tests that keep the layers, the text, the design system and the specification in step.

Garments carry a colour of Sanzo Wada's palette. The app builds outfits from the 348 combinations
of *A Dictionary of Color Combinations*, or around one garment.

## Develop

```sh
npm run serve   # http://localhost:8080
npm test
```

## Install on Android

Open the deployed URL in Chrome. Use the **Install** button of Settings, or Chrome menu →
**Install app**.

## Release and deploy

1. Write the user-visible changes under `## Unreleased` in `CHANGELOG.md`.
2. `npm run release` (or `npm run release -- minor|major`). It commits `Bump version to X.Y.Z`
   and creates the tag `vX.Y.Z`.
3. `git push --follow-tags`. The workflow `.github/workflows/pages.yml` deploys the tag.

Set the repository's Pages source to "GitHub Actions" once.

## Design system

`styles.css` holds the tokens and the components in five layers. Open `/designs/` on the dev
server for the catalogue. `docs/spec/04-design-system.md` has the rules.

## Credits

The palette and the combinations are those of *A Dictionary of Color Combinations* (Sanzo Wada,
1933), from `colors.json` of
[mattdesl/dictionary-of-colour-combinations](https://github.com/mattdesl/dictionary-of-colour-combinations)
(MIT, © 2020 Matt DesLauriers).
