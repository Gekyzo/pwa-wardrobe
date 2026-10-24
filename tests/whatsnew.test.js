import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNotes, unseen } from '#whatsnew';

const FILE = `# Release notes

## Unreleased

- Not deployed yet.

## 1.2.0 - 2026-10-20

- A new menu.
- \`Settings\` shows the version.

## 1.1.0 - 2026-10-10

- The list scrolls.
`;

const entry = (version, date = '2026-10-01') => ({ version, date, notes: ['A change.'] });

test('parseNotes gives each released version with its date and its notes, newest first', () => {
  assert.deepEqual(parseNotes(FILE), [
    { version: '1.2.0', date: '2026-10-20', notes: ['A new menu.', '`Settings` shows the version.'] },
    { version: '1.1.0', date: '2026-10-10', notes: ['The list scrolls.'] },
  ]);
});

test('parseNotes gives no entry for an empty file or a file with only Unreleased', () => {
  assert.deepEqual(parseNotes(''), []);
  assert.deepEqual(parseNotes('# Release notes\n\n## Unreleased\n\nNo change.\n'), []);
});

test('parseNotes skips a heading that is not a version and a date, and a version with no note', () => {
  const text = '## 1.2 - 2026-10-01\n\n- Short.\n\n## 1.3.0\n\n- No date.\n\n## 1.4.0 - 2026-10-02\n\nNo bullet.\n\n## 1.5.0 - 2026-10-03\n\n- Kept.\n';
  assert.deepEqual(parseNotes(text), [{ version: '1.5.0', date: '2026-10-03', notes: ['Kept.'] }]);
});

test('unseen gives the versions newer than the seen one', () => {
  const entries = [entry('1.2.0'), entry('1.1.0'), entry('1.0.0')];
  assert.deepEqual(unseen(entries, '1.0.0').map(({ version }) => version), ['1.2.0', '1.1.0']);
});

test('unseen gives nothing with no seen version, or a seen version that is the newest or newer', () => {
  const entries = [entry('1.2.0'), entry('1.1.0')];
  assert.deepEqual(unseen(entries, null), []);
  assert.deepEqual(unseen(entries, '1.2.0'), []);
  assert.deepEqual(unseen(entries, '2.0.0'), []);
});

test('unseen compares versions by number', () => {
  assert.deepEqual(unseen([entry('1.10.0')], '1.9.0').map(({ version }) => version), ['1.10.0']);
});
