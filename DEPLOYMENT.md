# Render Free deployment

Use a Node web service with Node.js 22 or newer. Select the Free instance type.

| Setting | Value |
| --- | --- |
| Root directory | `deploy-clean` (recommended prebuilt release) |
| Build command | `npm ci --omit=dev` |
| Start command | `npm start` |
| Health check | `/healthz` |

Required environment settings:

```text
NODE_ENV=production
CMS_PUBLIC_URL=https://YOUR-SITE.onrender.com
CMS_PASSWORD=your-unique-admin-password-of-at-least-12-characters
```

Render supplies `PORT`. The server binds `0.0.0.0` in production. No disk, Google account connection, API credentials, database, Redis or paid storage is required. The release has no runtime npm dependencies. Use the canonical HTTPS address from `CMS_PUBLIC_URL` for admin access; it is also the allowed origin for CMS mutations.

## Deploy the prepared release

Upload/commit the contents of `deploy-clean/`, or commit that directory and select it as the Render root. `3A-Logistics-clean-deploy.zip` contains the same release under `deploy-clean/`. It includes existing website artwork, fonts, generated pages, server code and `cms-images.json`; it excludes local credentials, uploads, caches, tests and development dependencies. The existing static artwork is shipped with the site and is not a CMS image cache.

The source project also supports the same install/start commands: its `postinstall` runs the dependency-free page build. After source changes, run `npm run build` and `npm run package:deploy`; the package script refreshes `deploy-clean/`. Recreate the ZIP if distributing it separately.

## Keep selected URLs after a restart

Live changes are held in server memory and take effect immediately. They reset to the deployed `cms-images.json` on restart, redeploy or Free-service sleep. Sessions reset too. To keep image selections:

1. Save your image URLs in the CMS.
2. Choose **Export URLs** and keep the downloaded `cms-images.json`.
3. Replace the `cms-images.json` in your source/release with that export and redeploy. When packaging from source, update the root copy first.

**Import URLs** restores an export into the current running process; it does not edit the deployed file. No automatic permanent save is claimed. This tradeoff avoids every durable runtime storage dependency.

Render documents its [Free-service sleep and ephemeral filesystem behavior](https://render.com/docs/free). Export live edits before leaving the CMS; service sleep is a restart boundary for memory.

## Check the release

Confirm `/healthz` returns HTTP 200, the website images load, `/admin/` signs in with the configured password, and saving/restoring an image URL works. Revisit after a restart to verify the deployed baseline. `/.env`, `/cms-images.json`, `/server.mjs` and private source paths must return 404. External image hosting availability and Drive public sharing must be checked independently; there is no server-side proxy or access-control workaround.
