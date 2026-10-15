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

A small notes list is a placeholder domain. The clothes and outfits domain replaces it.

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
