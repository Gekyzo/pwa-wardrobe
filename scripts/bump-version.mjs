// Writes the version of the next deploy to version.json and prints it. package.json gets
// the same version, and the changes under `Unreleased` in CHANGELOG.md get the version and
// the date. Run by scripts/release.mjs, which commits the bump and tags it.
import { readFileSync, writeFileSync } from 'node:fs';
import { parseVersion, nextVersion, LEVELS } from '#version';
import { releaseChangelog, localDate } from './changelog.mjs';

const file = new URL('../version.json', import.meta.url);
const manifest = new URL('../package.json', import.meta.url);
const changelog = new URL('../CHANGELOG.md', import.meta.url);
const [level = 'patch'] = process.argv.slice(2);

if (!LEVELS.includes(level)) {
  console.error(`Unknown level "${level}". Use one of: ${LEVELS.join(', ')}.`);
  process.exit(1);
}

const read = () => {
  try {
    return parseVersion(JSON.parse(readFileSync(file, 'utf8')));
  } catch {
    return null;
  }
};

const next = nextVersion(read(), new Date(), level);
writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`);
const data = JSON.parse(readFileSync(manifest, 'utf8'));
writeFileSync(manifest, `${JSON.stringify({ ...data, version: next.version }, null, 2)}\n`);

const release = { version: next.version, date: localDate(new Date(next.date)) };
try {
  const text = readFileSync(changelog, 'utf8');
  const released = releaseChangelog(text, release);
  if (released !== text) writeFileSync(changelog, released);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
console.log(next.version);
