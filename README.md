# 3A Logistics — prebuilt URL-based CMS

Node 22+. Deploy this directory as a Render Free Node web service.

- Build: `npm ci --omit=dev`
- Start: `npm start`
- Health: `/healthz`
- Set `NODE_ENV=production`, `CMS_PUBLIC_URL=https://YOUR-SITE.onrender.com` and a unique `CMS_PASSWORD` of 12+ characters. Render provides PORT.

The release includes existing static website artwork. Shipment tracking uses the MongoDB driver and the existing logistics database. No persistent disk, Google OAuth, or Drive API credentials are required. No upload/cache/mirror is created.

Paste an image URL in /admin/. The browser previews the external asset; the server redirects image placements to its URL. Public Drive sharing links are normalized without account access; Google may still refuse embedding.

Live changes are held in memory and reset to the deployed cms-images.json on restart or Free-service sleep. Export URLs, replace that file in the release/source, and redeploy to retain them. Import URLs applies references only for the current run.

See [IMAGE_MANAGER.md](IMAGE_MANAGER.md) and [DEPLOYMENT.md](DEPLOYMENT.md). The root-directory setting is only needed when this folder is nested in your repository. No source build is needed here.

## Shipment tracking

The public page is `/tracking/`. It accepts a 3A Booking Reference or Carrier AWB and shows status, route, dates, and status history. The website server reads the existing MongoDB database; the local logistics app can stay on your computer. The browser never receives database credentials.

Set these private environment variables on the website service:

```text
MONGODB_TRACKING_URI=mongodb+srv://READ_ONLY_USER:ENCODED_PASSWORD@YOUR_CLUSTER.mongodb.net/
MONGODB_TRACKING_DATABASE=3a_logistics
```

Create a dedicated MongoDB database user with **read** access to this database only, and allow the website host to reach MongoDB Atlas. Keep the URI in the host's private environment settings, never in Git or browser code. Then set **Company details → Website tracking page** in the logistics app to `https://3alogisticsindia.com/tracking/?awb={awb}`. Check a real booking and an unknown number before sending links to clients.
