# 🚀 Configuration Guide

This enhanced scraper supports multiple notification methods. You can enable any combination of these options.

## Quick Start (No Setup Required)

Just run the scraper and it will show results in the console:

```bash
node enhanced-scraper.js
```

## Environment Variables

Create a `.env` file in the project root with your preferred notification settings:

### Required
```bash
AIRBNB_JOBS_URL=https://careers.airbnb.com/positions/?_departments=engineering&_offices=bangalore-india
SCRAPE_INTERVAL=0 */30 * * * *
```

### Console Output (Default - Always Enabled)
```bash
CONSOLE_ENABLED=true
```

### File Logging (Easy Setup)
```bash
FILE_LOG_ENABLED=true
LOG_FILE_PATH=./job-alerts.log
```

### Email Notifications
```bash
EMAIL_ENABLED=true
EMAIL_SERVICE=gmail
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_specific_password
EMAIL_TO=recipient@email.com
```

**For Gmail:** You need to generate an App-Specific Password:
1. Go to Google Account settings
2. Security → 2-Step Verification → App passwords
3. Generate a new app password
4. Use that password in EMAIL_PASS

### Discord Notifications (Easiest Alternative!)
```bash
DISCORD_ENABLED=true
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_URL
```

**Setup:**
1. In your Discord server, go to Server Settings → Integrations → Webhooks
2. Create a new webhook
3. Copy the webhook URL

### Telegram Notifications (Also Easy!)
```bash
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

**Setup:**
1. Message @BotFather on Telegram and create a new bot
2. Get your bot token
3. Message @userinfobot to get your chat ID
4. Start a chat with your bot first

### Webhook Notifications (For Developers)
```bash
WEBHOOK_ENABLED=true
WEBHOOK_URL=https://your-webhook-endpoint.com/jobs
```

The webhook will receive a POST request with job data in JSON format.

## Cron Schedule Examples

```bash
# Every 30 minutes
SCRAPE_INTERVAL=0 */30 * * * *

# Every hour
SCRAPE_INTERVAL=0 0 * * * *

# Every 6 hours
SCRAPE_INTERVAL=0 0 */6 * * *

# Every day at 9 AM
SCRAPE_INTERVAL=0 0 9 * * *

# Weekdays only at 9 AM and 5 PM
SCRAPE_INTERVAL=0 0 9,17 * * 1-5
```

## Running the Scraper

```bash
# Basic version (email only)
node scraper.js

# Enhanced version (multiple notification options)
node enhanced-scraper.js
```

## Features of Enhanced Version

- ✅ Multiple notification methods
- ✅ Better error handling
- ✅ Persistent job tracking (saves state between restarts)
- ✅ Rich formatting for notifications
- ✅ Graceful shutdown
- ✅ Better scraping reliability
- ✅ Detailed logging

## Recommended Setup for Beginners

1. **Discord Method** (Easiest):
   - Create a Discord server
   - Set up a webhook
   - Enable Discord notifications

2. **File Logging**:
   - Always enable this as a backup
   - Creates a log file with all job alerts

3. **Console Output**:
   - Enabled by default
   - Great for testing and monitoring
