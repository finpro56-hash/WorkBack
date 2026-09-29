# WorkBack — Vercel Hosting Deployment Plan

This plan establishes the configuration and steps required to host your **WorkBack** Progressive Web App (PWA) on Vercel via GitHub continuous integration, ensuring correct routing fallback and configuring Google APIs/Firebase credentials to authorize your new production domain.

## Confirmed Deployment Decisions

> [!IMPORTANT]
> - **Deployment Method**: GitHub integration (Vercel automatically deploys every time you push code to your GitHub repo).
> - **Configuration**: We will create a custom `vercel.json` file to support:
>   - Single Page App (SPA) route rewrites (mapping all sub-routes to `/index.html` to avoid 404s on browser reloads).
>   - High-performance caching rules for PWA service workers and assets.
>   - Security and PWA headers (e.g., Service-Worker-Allowed).

---

## 1. Hosting Architecture & vercel.json Definition

Vercel hosts the application as a highly optimized static SPA on global edge networks. 

### Custom `vercel.json` Structure
We will add `vercel.json` to the project root with the following configuration:
```json
{
  "cleanUrls": true,
  "trailingSlash": false,
  "rewrites": [
    {
      "source": "/service-worker.js",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=0, must-revalidate"
        },
        {
          "key": "Service-Worker-Allowed",
          "value": "/"
        }
      ],
      "destination": "/service-worker.js"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/(pwa-.*|apple-touch-icon.png|icon.svg)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

---

## 2. Step-by-Step Vercel Deployment Flow

### Step 1: Create GitHub Repo & Push Code
1. Initialize a Git repository locally on your computer (if not already done).
2. Create a private or public repository on GitHub named `workback`.
3. Push your codebase to the repository:
   ```bash
   git remote add origin <your-github-repo-url>
   git branch -M main
   git push -u origin main
   ```

### Step 2: Import into Vercel Dashboard
1. Go to [Vercel](https://vercel.com) and sign in.
2. Click **Add New** > **Project**.
3. Select your GitHub repository (`workback`) and click **Import**.
4. Vercel will automatically detect **Vite** as the framework framework.
5. Keep default build settings:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
6. Click **Deploy**. Vercel will build and assign you a live deployment domain (e.g., `workback.vercel.app`).

---

## 3. Critical Domain Configuration (Authorized Redirects)

Since your application uses Firebase Auth for Google Sign-In and Google Workspace APIs (Sheets & Drive), **you must authorize your new Vercel domain** in both consoles, or authentication popup windows will block access.

### Task A: Whitelist in Firebase Console
1. Go to the [Firebase Console](https://console.firebase.google.com).
2. Select your project: `my-app-a3712`.
3. In the left menu, go to **Build** > **Authentication** > **Settings** tab.
4. Scroll down to **Authorized Domains** and click **Add Domain**.
5. Enter your Vercel deployment domain (e.g., `workback-abc.vercel.app` or custom domain `workback.yourdomain.com`).

### Task B: Whitelist in Google Cloud Console
1. Go to the [Google Cloud Console](https://console.cloud.google.com).
2. Select your project matching your credentials.
3. Go to **APIs & Services** > **OAuth consent screen**.
4. Under **Authorized domains**, add `vercel.app` (or your custom root domain).
5. Go to **APIs & Services** > **Credentials**.
6. Under **OAuth 2.0 Client IDs**, edit your Web client (matching your `oAuthClientId` `858642918908-5js29nlbee4qg6j5j80537u771523igm.apps.googleusercontent.com`).
7. Under **Authorized JavaScript origins**, add your Vercel URL (e.g., `https://workback.vercel.app`).
8. Click **Save**. Note: Google changes can take a few minutes to propagate.
