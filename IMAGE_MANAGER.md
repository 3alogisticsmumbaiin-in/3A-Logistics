# Image manager

Run `npm install`, then `npm start` and open `/admin/`. Set `CMS_PASSWORD` to your chosen password in local `.env` or the hosting environment. Production requires at least 12 characters. Local first-run password setup remains available, but lasts only until server restart; use the environment setting for repeatable access.

## Use an external image

1. Choose a page or Shared branding. Search, section grouping and the Original/Updated filter work as before.
2. Open the image editor, or click the image preview.
3. Paste an absolute HTTP(S) URL into **Image URL**. Use HTTPS on the deployed HTTPS site. The browser previews the image automatically; **Preview** retries it.
4. Check the preview and shared-page warning, then save. Every existing website placement for this image uses the new reference.
5. **Restore original** removes the reference and returns to the site's bundled original artwork.

No image is uploaded, copied, resized, fetched by the server or stored on disk. Existing website cropping, alt text, layout and animation are preserved. Match the original image shape; transparent artwork should retain its transparency. A cursor should be a browser-compatible small image (the CMS no longer resizes it).

Direct URLs retain their query strings, including signed URL parameters. Expiring links stop working when the image host expires them. A syntactically valid URL is not proof that it returns an image; preview failures are shown separately from validation errors.

## Google Drive sharing links

Upload and share the image yourself in Drive. Common `/file/d/ID/view`, `/open?id=ID`, `/uc?id=ID` and `/thumbnail?id=ID` links are normalized to a public thumbnail display URL. A supplied resource key is retained. The application never connects to your account or calls the Drive API.

The file must be publicly accessible, and Google must permit embedding it. See [Google's sharing instructions](https://support.google.com/drive/answer/2494822?hl=en). Folder links and unsupported Drive links are rejected. If Google refuses the image, the preview explains: "Image cannot be displayed from this Google Drive link. Make sure the file is publicly accessible or use a direct image URL." There is no guarantee that every shared Drive file can be embedded; use a direct image URL when necessary.

## Save references across restarts

The CMS stores only URL references and update timestamps in memory. The website reads the deployed `cms-images.json` as its startup baseline. Live selections and sign-in sessions clear on restart or Render Free sleep.

Use **Export URLs** to download the complete selection, then replace `cms-images.json` in the project/release and redeploy to make it the next startup baseline. **Import URLs** restores an export for the current server run and validates the whole document before changing anything. Export/import handles JSON references, never images. The dashboard displays this lifetime limitation.

The CMS manages image slots only. Page text, links, navigation and enquiry forms still live in the source files. See [DEPLOYMENT.md](DEPLOYMENT.md) for hosting.
