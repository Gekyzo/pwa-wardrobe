// Makes a release: bumps the version with bump-version.mjs, commits the bump and tags it
// vX.Y.Z. The push of the tag is the deploy: .github/workflows/pages.yml publishes the tagged
// commit. Usage: npm run release [-- minor|major], then git push --follow-tags.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseVersion, nextVersion, LEVELS } from '#version';

const root = fileURLToPath(new URL('..', import.meta.url));
const FILES = ['version.json', 'package.json', 'CHANGELOG.md'];
const [level = 'patch'] = process.argv.slice(2);

const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();

const stop = (message) => {
  console.error(`release: ${message}`);
  process.exit(1);
};

if (!LEVELS.includes(level)) stop(`unknown level "${level}". Use one of: ${LEVELS.join(', ')}.`);
if (git('symbolic-ref', '--quiet', '--short', 'HEAD') !== 'main') stop('a release is made on main.');
if (git('status', '--porcelain') !== '') stop('the working tree has changes. Commit them or stash them first.');

const current = parseVersion(JSON.parse(readFileSync(new URL('../version.json', import.meta.url), 'utf8')));
const tag = `v${nextVersion(current, new Date(), level).version}`;
if (git('tag', '--list', tag) !== '') stop(`the tag ${tag} exists already.`);

const version = execFileSync('node', ['scripts/bump-version.mjs', level], { cwd: root, encoding: 'utf8' }).trim();
git('commit', '--quiet', '-m', `Bump version to ${version}`, '--', ...FILES);
git('tag', '--annotate', `v${version}`, '-m', `Version ${version}`);
console.log(`Tagged v${version}. Deploy it: git push --follow-tags`);
