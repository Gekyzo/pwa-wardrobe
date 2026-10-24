// The release notes of `release-notes/<lang>.md`: what a user sees of each deploy.
import { compareVersions } from '#version';

const HEADING = /^## (\d+\.\d+\.\d+) - (\d{4}-\d{2}-\d{2})$/;

// The released versions of a file, in file order (newest first). `Unreleased`, a heading that
// is not `## X.Y.Z - YYYY-MM-DD` and a version with no `- ` note give no entry.
export const parseNotes = (text) =>
  text
    .split(/^(?=## )/m)
    .map((block) => {
      const [heading, ...lines] = block.split('\n');
      const match = HEADING.exec(heading.trim());
      if (!match) return null;
      const notes = lines.filter((line) => line.startsWith('- ')).map((line) => line.slice(2).trim());
      return notes.length ? { version: match[1], date: match[2], notes } : null;
    })
    .filter(Boolean);

// The entries newer than `seen`. With no seen version there is nothing to show (first start).
export const unseen = (entries, seen) =>
  seen ? entries.filter(({ version }) => compareVersions(version, seen) > 0) : [];
