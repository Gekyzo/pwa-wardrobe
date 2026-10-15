// The release of CHANGELOG.md: the changes under `Unreleased` get the version and the date of
// the deploy, and a new `Unreleased` with no change goes above them. No dependencies.

const HEADING = /^## Unreleased[ \t]*$/m;
const NO_CHANGE = /^No change\.?$/;
const EMPTY = '## Unreleased\n\nNo change.\n\n';

// The day of `date` in the local time zone, as `YYYY-MM-DD`.
export const localDate = (date) =>
  [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part) => String(part).padStart(2, '0'))
    .join('-');

// Returns `text` with the changes of `Unreleased` under `## version - date`. Returns `text`
// as it is when it has no `Unreleased` heading or the heading has no change.
export const releaseChangelog = (text, { version, date }) => {
  const heading = HEADING.exec(text);
  if (!heading) return text;
  const start = heading.index + heading[0].length;
  const next = text.indexOf('\n## ', start);
  const body = text.slice(start, next === -1 ? text.length : next).trim();
  if (!body || NO_CHANGE.test(body)) return text;
  return `${text.slice(0, heading.index)}${EMPTY}## ${version} - ${date}${text.slice(start)}`;
};
