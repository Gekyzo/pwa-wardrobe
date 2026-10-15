# wardrobe

Wardrobe: load my clothes and generate outfits. An offline Android PWA in plain HTML, CSS and
ES modules, no build step and no dependencies, scaffolded from `pwa-template`.

## Commands

```sh
npm test                           # unit tests (node --test)
npm run serve                      # http://localhost:8081
npm run icons                      # write the PNG icons again from icons/source.png
npm run init -- <slug> "<Name>"    # turn a copy into a new app (once)
npm run release                    # bump, commit and tag vX.Y.Z; git push --follow-tags deploys
```

## Conventions

Read `.claude/conventions/` (loaded at session start): GIT, WRITING, CANONICAL,
WORKFLOW, AUTONOMY, ARCHITECTURE, RELEVANT-FILES.
