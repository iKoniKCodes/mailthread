# Mailthread

A mobile Next.js and React inbox with a Cloudflare Worker API. The full Contacts, Campaigns, calendar, CSV, and HTML campaign designer is available under `/demo/`. It uses sample data and never sends mail. The authenticated Next.js shell opens the live workspace built from the same design as the demo. It supports multiple Gmail addresses, history search, full threads, downloads, rich compose and replies, and reviewed HTML campaign sends. Contacts, CSV imports, mailing lists, campaign history, and planning are stored on this device. OAuth uses Cloudflare KV only for encrypted provider tokens.

## Next.js

Use Node.js 22 or newer, run `npm install`, then `npm run build`. Next.js exports static files to `out/`. The postbuild script generates the authenticated workspace in `out/workspace.html` from the demo layout and the live Gmail adapter. Serve that directory as the static-assets binding `ASSETS` on the same Worker that handles `/api/*`. Uploaded API assets must route requests for `/api/*` through the Worker. Run `npm run deploy` with `CLOUDFLARE_ACCOUNT_ID`, `MAILTHREAD_KV_ID`, and `CLOUDFLARE_API_TOKEN` set to deploy the exported assets and API via Cloudflare's direct-upload API. The Worker can also run by itself as a demo host with the compressed preview in KV at `demo:html`.

## Live mailbox setup

Use a single-user Worker. Bind a Cloudflare KV namespace as `MAILTHREAD_STORE`. Set separate random Worker secrets `MAILTHREAD_ACCESS_KEY` (at least 24 characters) and `MAILTHREAD_ENCRYPTION_KEY` (at least 32 characters). Set the provider OAuth client ID and secret as Worker secrets. Add only provider accounts you control in the provider console and authorize each address from Mailboxes.

- Enable Gmail API and create a Google OAuth web application. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. The callback is `https://mailthread.02-ikonik.workers.dev/api/callback/gmail`. Add the Gmail addresses as test users if using a Google app in testing.
- Register a Microsoft Entra application for organizational and personal Microsoft accounts. Configure delegated `User.Read`, `Mail.ReadWrite` and `Mail.Send`, register the callback `https://mailthread.02-ikonik.workers.dev/api/callback/outlook`, and set `MICROSOFT_CLIENT_ID` and `MICROSOFT_CLIENT_SECRET`.
- Use the host actually serving Mailthread in the callback URLs if deploying to a different origin. Never put access keys, OAuth client secrets, or tokens in source control.

The inbox lists recent inbox conversations within a 180-day window. The first version uses capped provider queries and refreshes while the app is open. Durable history import, background push notifications, scheduled send, and Calendar, Zoom and Drive integration are not live.
