# Vercel Environment Variables Setup

## Required Environment Variables for Production

### 1. MultiSynq API Key
Add this environment variable in your Vercel dashboard:

**Variable Name:** `VITE_MULTISYNQ_API_KEY_PROD`
**Value:** [YOUR_PRODUCTION_API_KEY_HERE]

### 2. Setup Steps:

1. Go to your Vercel dashboard: https://vercel.com/dashboard
2. Select your project: `monnapy-vite`
3. Go to Settings → Environment Variables
4. Add the following variable:
   - **Name:** `VITE_MULTISYNQ_API_KEY_PROD`
   - **Value:** [PASTE YOUR PRODUCTION API KEY HERE]
   - **Environment:** Production (select all environments if needed)

### 3. Alternative Setup via CLI:

```bash
# Install Vercel CLI if not installed
npm i -g vercel

# Add environment variable
vercel env add VITE_MULTISYNQ_API_KEY_PROD production
```

### 4. Testing:

After setting up the environment variable:
1. Redeploy your application
2. Check the live site to ensure MultiSynq is working
3. Open in multiple browsers/devices to test real-time leaderboard

### 5. Current Configuration:

- **Development:** Uses `VITE_MULTISYNQ_API_KEY` from `.env` file
- **Production:** Uses `VITE_MULTISYNQ_API_KEY_PROD` from Vercel environment variables

---

**Important:** Never commit production API keys to Git. They should only be set in Vercel's environment variables.
