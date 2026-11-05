// The move from the old address to the new one (ADDR-1 to ADDR-5): which origin this is, the
// backup packed into a URL fragment, and what the button does for each kind of user.
import { importJson } from '#storage';
import { normalizeGarments } from '#garments';

export const OLD_HOST = 'gekyzo.github.io';
export const NEW_ORIGIN = 'https://attire.artisandevs.duckdns.org';
// The whole `#import=…`, in characters. Chrome takes URLs of 2 MB; this leaves room.
export const MAX_HASH = 1_000_000;

const PREFIX = '#import=';
const NOT_BACKUP = { error: { key: 'error.notBackup' } };

export const isOldOrigin = (hostname) => hostname === OLD_HOST;

const pipe = async (bytes, stream) =>
  new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());

// In chunks: one `String.fromCharCode(...bytes)` of a large backup overflows the call stack.
const toBase64url = (bytes) => {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
};

const fromBase64url = (text) => {
  if (!/^[\w-]+$/.test(text)) throw new Error('not base64url');
  const binary = atob(text.replaceAll('-', '+').replaceAll('_', '/'));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

// null with no CompressionStream (Safari before 16.4): the user exports instead (ADDR-4).
export const encodeMove = async (json) => {
  if (typeof CompressionStream !== 'function') return null;
  return PREFIX + toBase64url(await pipe(new TextEncoder().encode(json), new CompressionStream('deflate-raw')));
};

// null: the hash is no move. Else the result of Import (BACKUP rules), or not a backup.
export const decodeMove = async (hash) => {
  if (!hash.startsWith(PREFIX)) return null;
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(await pipe(fromBase64url(hash.slice(PREFIX.length)), new DecompressionStream('deflate-raw')));
  } catch {
    return NOT_BACKUP;
  }
  return importJson(text, normalizeGarments);
};

// ADDR-5: `clear` removes the fragment from the URL before the decode, so a reload imports nothing.
export const takeMove = async (hash, clear) => {
  if (!hash.startsWith(PREFIX)) return null;
  clear();
  return decodeMove(hash);
};

// ADDR-6, SYNC-9: with a session an import replaces the garments of the account on every device.
export const replaceKey = (signedIn) => (signedIn ? 'import.confirmAccount' : 'move.replace');

// ADDR-6, ACC-1: a signed-out user had the app open on the old address, so the new one opens it too,
// with no Sign in in front of the moved garments and their message.
export const keepsOffline = ({ imported, signedIn }) => imported && !signedIn;

export const moveUrl = (hash, search) => (hash.length > MAX_HASH ? null : `${NEW_ORIGIN}/${search}${hash}`);

// ADDR-2: a session never travels in a URL. A signed-in user syncs first; only a clean sync of an
// approved account moves with no data (the account brings it back). Any other end carries the data,
// so a pending approval, a stopped session or a failed send never strands the garments.
export const moveMode = ({ signedIn, online, sync }) => {
  if (!signedIn) return 'carry';
  if (!sync) return online ? 'sync' : 'wait';
  return sync.result === 'ok' && sync.pending === 0 && sync.approved ? 'go' : 'carry';
};
