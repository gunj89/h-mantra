# H Mantra - editable hero + portfolio (Appwrite)

The client edits the home-page hero (photo **or** looping video) and the portfolio at `/admin.html` (no login).
Content lives in Appwrite; the public pages load it and fall back to the built-in static
content if Appwrite is empty or unreachable.

## One-time setup (you)

1. **Appwrite project** - create one at https://cloud.appwrite.io (or your self-hosted server). Note the *Project ID*.
2. **API key** - Project -> Overview -> Integrations -> API keys -> Create. Scopes needed:
   `databases.read/write`, `collections.read/write`, `attributes.read/write`, `documents.read/write`,
   `buckets.read/write`, `files.read/write` (or just select all scopes, then delete the key afterwards).
3. **Run the script** (Node 18+), from the `setup/` folder:
   ```bash
   cd setup && npm install
   APPWRITE_PROJECT_ID=xxxx APPWRITE_API_KEY=xxxx node setup.mjs
   ```
   It creates the database, collections and `media` bucket, uploads the
   current hero + 67 portfolio photos, and writes `assets/js/config.js`. Re-running is safe.
   Do **not** commit/upload the API key. It is only used on your machine.
4. **Allow your domain** - Console -> Overview -> Integrations -> Add platform -> Web:
   add the live domain (and `www.`), plus `localhost` for testing. Without this the browser blocks requests.
5. Upload the site as usual (the `setup/` folder is not needed on the host). Open `/admin.html`.

Serve the site over http(s) (not by double-clicking the file) when testing locally, e.g. `npx serve .`

## For the client

- **Home Hero** tab: choose *Photo* or *Video*, pick the file, press *Upload & publish*.
  Photos are resized automatically. Videos: MP4, ideally under 25 MB and 10-20 seconds; they play muted and loop.
- **Portfolio** tab: *Add photos* (several at once, set title + category), edit a title/category (saves
  automatically), untick *Show on site* to hide, arrows / *To top* to reorder, *Replace*, *Delete*.

## Notes

- **No login.** `admin.html` is protected only by nobody knowing its address (it is not linked from the site and is
  `noindex`). Appwrite permissions allow anyone to read **and write** the content, so anyone who learns the address,
  or reads the Project ID in `assets/js/config.js`, can change or delete the portfolio. Mitigations: rename
  `admin.html` to something unguessable (e.g. `manage-7f3k2.html`), and don't share the link around.
- Categories are fixed to the filter buttons in `portfolio.html`. To add one, add a button there
  and an entry in `CATEGORIES` at the top of `assets/js/admin.js`.
- The "Featured projects" strip on the home page is still static HTML.
- Free Appwrite Cloud projects may be paused after a period of inactivity, and have file-size limits.
  For a client site, check your plan or self-host.
- Visitors' browsers cache the last content, so a change may need one extra reload to show on a returning visitor.
