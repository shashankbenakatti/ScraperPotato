# 🚀 Cloudflare Workers Deployment Guide

This guide will help you deploy your Airbnb Job Scraper to Cloudflare Workers for serverless, scheduled execution.

## 🏗️ Architecture Overview

Your scraper will run on Cloudflare Workers with:
- **Cron Triggers**: Automatically runs every 2 days
- **KV Storage**: Stores job hashes and data persistently  
- **MailSlurp Integration**: Sends beautiful email notifications
- **HTTP Endpoints**: Manual triggers and status monitoring

## 📋 Prerequisites

1. **Cloudflare Account**: Sign up at [cloudflare.com](https://cloudflare.com)
2. **Wrangler CLI**: Already installed in your project
3. **MailSlurp API Key**: Your existing key will work

## 🚀 Step-by-Step Deployment

### 1. Authenticate with Cloudflare

```bash
npx wrangler login
```

This opens your browser to authenticate with Cloudflare.

### 2. Create KV Namespace

```bash
npm run kv:create
npm run kv:create:preview
```

Copy the namespace IDs from the output and update `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "JOB_STORAGE"
id = "your-production-kv-id-here"
preview_id = "your-preview-kv-id-here"
```

### 3. Set Environment Variables

Set your secrets (these won't be visible in code):

```bash
# Set your MailSlurp API key
npx wrangler secret put MAILSLURP_API_KEY
# Enter: c18e5e0c61756ce583cd95c9a4b72a5d0e449ac30aba96e65183bef2f53d116d

# Set your email receiver
npx wrangler secret put EMAIL_RECEIVER
# Enter: your-email@example.com

# Set job keywords (optional, defaults included)
npx wrangler secret put JOB_KEYWORDS
# Enter: Software,Backend,Senior,Lead,Full Stack,DevOps

# Set Airbnb URL (optional, default included)
npx wrangler secret put AIRBNB_JOBS_URL
# Enter: https://careers.airbnb.com/positions/?_departments=engineering&_offices=bangalore-india
```

### 4. Test Locally

```bash
npm run dev:worker
```

Visit the URLs to test:
- `http://localhost:8787/` - Main page
- `http://localhost:8787/status` - Status and logs
- `http://localhost:8787/trigger` - Manual job check
- `http://localhost:8787/test-email` - Test email functionality

### 5. Deploy to Production

```bash
npm run deploy
```

Your worker will be deployed and available at:
`https://airbnb-job-scraper.your-subdomain.workers.dev`

## 🔧 Configuration Files Created

### `wrangler.toml`
- Worker configuration
- Cron schedule (every 2 days)
- KV namespace bindings
- Environment settings

### `src/worker.js`
- Main Worker script
- HTTP request handling
- Cron job processing
- Job scraping logic

### `src/worker-email-service.js`
- MailSlurp integration for Workers
- HTML email generation
- Keyword filtering

## 📊 Monitoring & Management

### Check Status
```bash
# View real-time logs
npm run tail

# Check deployment status
npx wrangler deployments list
```

### Manual Operations
Visit your worker URL endpoints:

- **`/status`** - View current status, job count, recent logs
- **`/trigger`** - Manually trigger a job check
- **`/test-email`** - Test email functionality

### View KV Data
```bash
# List all KV keys
npx wrangler kv:key list --binding JOB_STORAGE

# Get specific values
npx wrangler kv:key get "jobs-hash" --binding JOB_STORAGE
npx wrangler kv:key get "latest-jobs" --binding JOB_STORAGE
npx wrangler kv:key get "activity-logs" --binding JOB_STORAGE
```

## ⏰ Cron Schedule

**Default**: Every 2 days at midnight UTC
```
0 0 */2 * *
```

**Alternative schedules** (edit in `wrangler.toml`):
```bash
# Every day at 9 AM UTC
0 9 * * *

# Every Monday and Friday at 9 AM UTC  
0 9 * * 1,5

# Every 6 hours
0 */6 * * *
```

## 💾 Data Storage

Your Worker uses KV storage for:

| Key | Purpose |
|-----|---------|
| `jobs-hash` | SHA256 hash of current job listings |
| `latest-jobs` | Complete job data from last scrape |
| `activity-logs` | Last 10 activity log entries |

## 🔐 Security Features

- **Environment Variables**: Secrets stored securely in Cloudflare
- **No Code Exposure**: Sensitive data never in source code
- **HTTPS Only**: All communications encrypted
- **Access Control**: Only you can trigger manual operations

## 📈 Advantages of Workers Deployment

### Cost Effective
- **Free Tier**: 100,000 requests/day included
- **Pay Per Use**: Only pay for actual executions
- **No Server Costs**: Completely serverless

### Reliable
- **Global Distribution**: Runs on Cloudflare's edge network
- **99.99% Uptime**: Enterprise-grade reliability
- **Auto Scaling**: Handles any load automatically

### Easy Management
- **Web Dashboard**: Manage via Cloudflare dashboard
- **CLI Tools**: Deploy and monitor from command line
- **Real-time Logs**: See what's happening instantly

## 🛠 Troubleshooting

### Common Issues

**1. KV Namespace Not Found**
```bash
# Create namespaces and update wrangler.toml with the IDs
npm run kv:create
npm run kv:create:preview
```

**2. Email Not Sending**
```bash
# Test email service
curl https://your-worker.workers.dev/test-email
```

**3. Scraping Not Working**
```bash
# Check logs in real-time
npm run tail

# Manual trigger to see errors
curl https://your-worker.workers.dev/trigger
```

**4. Cron Not Running**
- Check Cloudflare dashboard → Workers → Cron Triggers
- Verify cron syntax in `wrangler.toml`
- Look at execution logs in dashboard

### Debug Commands

```bash
# View recent deployments
npx wrangler deployments list

# Check worker status
npx wrangler dev --local

# View all secrets
npx wrangler secret list

# Check KV storage
npx wrangler kv:key list --binding JOB_STORAGE
```

## 🎯 What You Get

After deployment, your scraper will:

1. **Run Automatically**: Every 2 days via cron triggers
2. **Store State**: Uses KV storage for persistence
3. **Send Emails**: Only when new matching jobs appear
4. **Provide Status**: HTTP endpoints for monitoring
5. **Scale Infinitely**: Handles any load automatically
6. **Cost Almost Nothing**: Likely stays within free tier

## 🔄 Updates and Maintenance

To update your scraper:

```bash
# Make changes to src/worker.js or src/worker-email-service.js
# Then redeploy
npm run deploy
```

To update environment variables:
```bash
npx wrangler secret put VARIABLE_NAME
```

Your job scraper is now running on enterprise-grade infrastructure with global distribution! 🎉

## 📱 Quick Reference

| Command | Purpose |
|---------|---------|
| `npm run deploy` | Deploy to production |
| `npm run dev:worker` | Test locally |
| `npm run tail` | View real-time logs |
| `npx wrangler secret put KEY` | Set environment variable |
| `npx wrangler kv:key get KEY --binding JOB_STORAGE` | View stored data |
