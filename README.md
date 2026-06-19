# botfrontEnd

Frontend web files for the Zllawi be honest bot dashboard, public landing page, and user portal.

## Contents

- `src/web/public/` - browser assets: CSS, client JS, and PNG assets.
- `src/web/renderDashboardPage.js` - dashboard HTML renderer.
- `src/web/renderPublicLandingPage.js` - public landing page HTML renderer.
- `src/web/renderUserPortalPage.js` - user portal HTML renderer.
- `src/web/dashboardSchema.js` - dashboard page/component schema.

Some files under `src/web` still expect the original bot backend APIs, for example `/api/dashboard/*`, Discord OAuth routes, and bot data services. This repository is the separated frontend source, not a fully standalone deployment yet.

## Push to GitHub

From this folder, run:

```powershell
git init
git branch -M main
git add .
git commit -m "Add separated bot frontend"
git remote add origin https://github.com/Zllawi/botfrontEnd.git
git push -u origin main
```

If the remote already has commits, run `git pull --rebase origin main` before pushing.

## Vercel

Use these project settings:

```text
Framework Preset: Other
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

Set these environment variables in Vercel:

```text
PUBLIC_INVITE_URL=https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=8&integration_type=0&scope=bot+applications.commands
PUBLIC_BACKEND_URL=https://YOUR-BACKEND-URL
```

`PUBLIC_INVITE_URL` enables the invite button. `PUBLIC_BACKEND_URL` enables the Discord OAuth login button and should point to the deployed bot backend that serves `/auth/discord/login` and `/dashboard`.
