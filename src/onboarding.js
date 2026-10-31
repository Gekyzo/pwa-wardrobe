// The pages of the walkthrough of the first start, in their order.
export const PAGES = ['welcome', 'offline'];

// The walkthrough shows at the start of a new install only: no seen flag and no stored state.
export const shouldShow = ({ seen, hasState }) => !seen && !hasState;

// The index of the page after a move of `direction` (1, -1 or 0). It stays in the pages.
export const step = (index, direction) => Math.min(Math.max(index + direction, 0), PAGES.length - 1);

export const isLast = (index) => index === PAGES.length - 1;

// A key that starts with `#name` shows the icon `name` of the sprite, then the rest of its text.
const keyPart = (text) => {
  const match = text.match(/^#([a-z][\w-]*)(?: (.*))?$/s);
  return match ? { text: match[2] ?? '', key: true, icon: match[1] } : { text, key: true };
};

// Splits `text` at each `mark`. The odd pieces lie between a pair of marks; a last mark with no
// pair stays in the text of the piece before it.
const paired = (text, mark) => {
  const pieces = text.split(mark);
  // An even count of pieces means that the last mark has no pair.
  if (pieces.length % 2 === 0) pieces.push(pieces.splice(-2).join(mark));
  return pieces.map((piece, index) => ({ text: piece, inside: index % 2 === 1 }));
};

// The parts of a page text. A text between two backticks is a key, such as `↻` or `+`; a text
// between two `**` is bold (`strong: true`), and it can hold keys too. A backtick or a `**` with
// no pair stays in the text.
export const textParts = (text) =>
  paired(text, '**')
    .flatMap(({ text: run, inside: strong }) =>
      paired(run, '`').map(({ text: piece, inside: key }) => ({ text: piece, key, strong })))
    .filter((part) => part.text)
    .reduce((joined, { text: piece, key, strong }) => {
      const last = joined.at(-1);
      if (last && !last.key && !key && Boolean(last.strong) === strong) last.text += piece;
      else {
        const part = key ? keyPart(piece) : { text: piece, key: false };
        joined.push(strong ? { ...part, strong: true } : part);
      }
      return joined;
    }, []);
