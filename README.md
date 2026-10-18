# IronLog - Gym Weight Training & PR Tracker

A local-first Progressive Web App (PWA) designed to track weight training at the gym with progressive overload memory, personal record (PR) calculation, and an automated rest timer.

Live Azure Static Web App URL: **[https://orange-river-0ccca550f.6.azurestaticapps.net](https://orange-river-0ccca550f.6.azurestaticapps.net)**

---

## Architecture

### Phase 1: Local-First PWA (Current)
* **Local Storage**: IndexedDB database (`IronLogDB`) storing all completed workouts, exercises, PRs, and user settings.
* **100% Offline Resilience**: Service Worker (`sw.js`) caches all assets using a stale-while-revalidate strategy so the app functions seamlessly in gym basements or airplane mode.
* **Active Workout Session & Memory**:
  - Live elapsed time tracker.
  - Set-by-set progressive overload comparison displaying previous performance (e.g. *"Last: 185 lbs × 8"*).
  - One-tap checkmark set completion.
* **Auto-Starting Rest Timer**:
  - Automatically begins countdown when a set is completed.
  - Audio alert synthesized via Web Audio API (zero external mp3 downloads required).
  - Dual-pulse haptic vibration feedback.
* **Personal Record (PR) Engine**:
  - Calculates estimated 1RM via Epley formula: $\text{Weight} \times (1 + \frac{\text{Reps}}{30})$.
  - Detects new weight or 1RM records in real time and awards celebratory badges.
* **Cost**: **$0.00 / month** on Azure Static Web Apps Free Tier.

### Phase 2: Cloud Sync Layer (Upcoming)
* Connects an `/api/sync` Azure Functions backend to **Azure Cosmos DB** (Free Tier / Serverless).
* Automatically uploads workouts marked with `isSynced: false` to the cloud when an internet connection is detected.

---

## GitHub Actions Continuous Deployment (CD)

Every commit pushed to the `main` branch automatically deploys to Azure Static Web Apps via GitHub Actions:

1. In your GitHub repository (`arauj1/workout-tracker`), navigate to:
   **Settings** > **Secrets and variables** > **Actions**.
2. Click **New repository secret**.
3. Name: `AZURE_STATIC_WEB_APPS_API_TOKEN`
4. Value: *(Your SWA deployment token)*
5. Click **Add secret**.

Subsequent pushes to `main` will build and deploy within seconds.
