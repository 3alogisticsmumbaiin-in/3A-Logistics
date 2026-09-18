# 3A Logistics — prebuilt URL-based CMS

Node 22+. Deploy this directory as a Render Free Node web service.

- Build: `npm ci --omit=dev`
- Start: `npm start`
- Health: `/healthz`
- Set `NODE_ENV=production`, `CMS_PUBLIC_URL=https://YOUR-SITE.onrender.com` and a unique `CMS_PASSWORD` of 12+ characters. Render provides PORT.

The release includes existing static website artwork and has zero runtime npm dependencies. No persistent disk, Google OAuth, Drive API credentials or external storage service is required. No upload/cache/mirror is created.

Paste an image URL in /admin/. The browser previews the external asset; the server redirects image placements to its URL. Public Drive sharing links are normalized without account access; Google may still refuse embedding.

Live changes are held in memory and reset to the deployed cms-images.json on restart or Free-service sleep. Export URLs, replace that file in the release/source, and redeploy to retain them. Import URLs applies references only for the current run.

See [IMAGE_MANAGER.md](IMAGE_MANAGER.md) and [DEPLOYMENT.md](DEPLOYMENT.md). The root-directory setting is only needed when this folder is nested in your repository. No source build is needed here.
