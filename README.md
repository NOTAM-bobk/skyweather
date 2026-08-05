# Sky — a weather app

Vite + React. Material 3 Expressive styling where the whole palette
re-themes itself to the current sky (sunny gold, storm violet, snow
periwinkle, etc). Built on the Xweather Weather API + Raster Maps.

## Files that matter
- `src/main.jsx` — entry point
- `src/App.jsx` — main app: fetches weather, renders the dashboard
- `src/Onboarding.jsx` — first-run flow (location + a preference)
- `src/Radar.jsx` — live radar map
- `src/index.css` — design tokens / theme

## 1. Get your Xweather credentials
You already have a key. Xweather issues a **client ID** and **client
secret** as a pair. Because this key was shared in a chat, regenerate
it in your Xweather dashboard (Account → Keys) before going live, then
use the *new* id/secret below.

## 2. Set environment variables
Locally: copy `.env.example` to `.env` and fill in:
```
VITE_XWEATHER_CLIENT_ID=your_id
VITE_XWEATHER_CLIENT_SECRET=your_secret
```
On Vercel: Project → Settings → Environment Variables, add the same
two names/values. Never commit `.env` (it's already git-ignored).

## 3. Deploy on Vercel (no local computer needed)
1. On GitHub.com, create a new repository.
2. Click **Add file → Upload files**, drag in everything from this
   zip (keep the folder structure — `src/` should stay a folder).
3. Commit.
4. Go to vercel.com → **Add New Project** → import that GitHub repo.
   Vercel auto-detects Vite; leave the defaults.
5. Add the two environment variables from step 2 before deploying.
6. Deploy. Vercel gives you a live `.vercel.app` URL.

## Note on the API key living in the browser
Xweather's own security model restricts a key by domain, not by
secrecy (see their docs on "namespace"), so it's normal for it to
appear in client-side requests — just set your key's namespace to
your Vercel domain in the Xweather dashboard once you have it, so a
copied key can't be used elsewhere. If you'd rather hide it
completely, that's the natural next step when we expand: a small
serverless function in `api/` that proxies the requests server-side.
