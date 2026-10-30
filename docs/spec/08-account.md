# Account

The account and the approval gate. The server is the PocketBase server of `pwa-server`: one
account serves every app, and the administrator approves access per app. The app talks to it
with `fetch`, with no SDK. The garments of an approved account sync between its devices
([09-sync.md](09-sync.md)). The user picks one of two ways in: **Continue with Google**, or
**Use offline** with no account.

## Rules

- **ACC-1** The start routes by the saved session, then by the offline flag (ACC-10): a session
  that is not approved opens **Waiting for approval**; an approved session opens the app; no
  session and the flag opens the app; no session and no flag opens **Sign in**. The route never
  reads the clock.
- **ACC-2** **Sign in** has the app icon, the title, one line of text, **Continue with
  Google** and **Use offline**. **Waiting for approval** has **Check again** and **Log out**. Both
  cover the whole app, the walkthrough too. **Use offline** closes **Sign in** (ACC-10); with the
  offline flag set, `Escape` closes it too. Else `Escape` does nothing while one is open. An
  error shows below the button: `account.error.google`, `account.error.network` or
  `account.error.tooMany`. A button waits for its request, so a second tap sends nothing.
- **ACC-3** "Approved" is the `app_access` row of the app `APP_SLUG` with the status
  `approved`. Each sign-in and each refresh reads it. With no row, the app creates a `pending`
  one; a duplicate row that another device made meanwhile is read again. The server URL is
  `http://localhost:8090` on a local host, else `https://artisandevs.duckdns.org`.
- **ACC-4** Google sign-in is a redirect. The app asks the server for the URL of the provider,
  keeps the state and the verifier in `sessionStorage` (`wardrobe.oauth`), and sends the browser
  there with the URL of the app as the return address. On return the app removes `code`, `state`
  and `error` from the URL at once and keeps each other parameter. A return with no `code` (a
  cancel at Google), with no pending sign-in or with another `state` shows **Sign in** with
  `account.error.google`.
- **ACC-5** The session, the token and the user, is stored in `wardrobe.session`.
- **ACC-6** At the start when online, and at the `online` event, the app refreshes a saved
  session. An approved session keeps the app open; a session that is no longer approved opens
  **Waiting for approval**; an auth error removes the session and opens **Sign in**. A network or
  server error changes nothing. A logout during the request makes the answer save nothing.
- **ACC-7** **Check again** refreshes the session as ACC-6. A session that is still not approved
  shows the toast `account.waiting.still`.
- **ACC-8** Settings has the group **Account**: with a session, the email and **Log out**; with
  none, **Sign in with Google**, which opens **Sign in**. **Log out** runs as ACC-12: the
  device preferences and the offline flag stay. It then routes as ACC-1: with the offline flag
  the app stays open, else **Sign in** shows.
- **ACC-9** With no `localStorage` the app shows no account screen and works as before.
- **ACC-10** The offline flag is `wardrobe.offline` = `1` in `localStorage`. **Use offline**
  writes it; an approved session that opens the app removes it. A storage that refuses the
  write still opens the app for this start.
- **ACC-11** A login of a user other than the stored owner first clears the device: the garments,
  the sync state and the queue of the previous user, so no change of that user reaches the new
  account. Then the new user takes the account (SYNC-8). A device preference stays. When the queue
  is not empty, the login first offers an export and changes nothing, the session too; after the
  export, or when the user declines it, the login clears and goes on. A device with no stored
  owner clears nothing and merges (SYNC-8). A session that is not approved changes nothing and
  asks nothing until the approval (ACC-3).
- **ACC-12** **Log out** when online sends the queue first. When changes are still not sent
  (offline, or the sync stopped), the app offers an export first and changes nothing; after the
  export, or when the user declines it, the logout goes on. It removes the garments, the sync
  state, the queue and the session, and closes the stream. A run in progress becomes stale. The
  device preferences and the offline flag stay.

## Set-up outside the app

- The server has a row in `apps`: slug `wardrobe`, url `https://gekyzo.github.io/pwa-wardrobe/`.
- The Google OAuth client has the redirect URIs `https://gekyzo.github.io/pwa-wardrobe/` and
  `http://localhost:8081/` (`npm run serve`).
