# 🚀 Airbnb Job Scraper

A powerful Node.js application that automatically scrapes Airbnb's career page for engineering job openings in Bangalore and sends notifications through multiple channels.

## ✨ Features

- **Multiple Notification Methods**: Email, Discord, Telegram, Webhooks, Console, File logging
- **Smart Job Tracking**: Remembers previously seen jobs to avoid duplicates
- **Configurable Scheduling**: Run on any schedule using cron patterns
- **Robust Scraping**: Built with Puppeteer for reliable data extraction
- **Easy Setup**: Multiple options from zero-config to full customization
- **Graceful Operation**: Handles errors, saves state, clean shutdown

## 🚀 Quick Start (No Setup Required)

```bash
npm install
npm test        # Test the scraper
npm start       # Run with console output only
```

## 📋 Available Scripts

```bash
npm test        # Test scraper functionality
npm start       # Run enhanced version
npm run basic   # Run basic email-only version
npm run dev     # Development mode (same as start)
```

## 🔧 Setup Options

### Option 1: Console Only (Zero Setup)
Just run the scraper - it will show new jobs in the terminal:
```bash
npm start
```

### Option 2: Discord Notifications (Easiest)
1. Create a Discord webhook in your server
2. Create `.env` file:
```bash
DISCORD_ENABLED=true
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_URL
```

### Option 3: Email Notifications
Create `.env` file with:
```bash
EMAIL_ENABLED=true
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_specific_password
EMAIL_TO=recipient@email.com
```

### Option 4: Multiple Notifications
See `config-guide.md` for complete configuration options including Telegram, webhooks, and file logging.

## 📊 Test Results

✅ **Current Status**: Working perfectly!
- Successfully extracts job listings
- Found 3 current engineering positions in Bangalore
- Handles all job details (title, department, location, links)

## 🛠 Configuration

All configuration is optional and done through environment variables in a `.env` file:

- `AIRBNB_JOBS_URL`: Target URL (default: Bangalore engineering jobs)
- `SCRAPE_INTERVAL`: Cron schedule (default: every 30 minutes)
- `*_ENABLED`: Enable/disable specific notification methods
- See `config-guide.md` for complete details

## 📁 Files

- `enhanced-scraper.js` - Main application with all features
- `scraper.js` - Basic email-only version
- `test-scraper.js` - Test functionality
- `config-guide.md` - Detailed configuration guide

## 🔍 How It Works

1. **Scraping**: Uses Puppeteer to load Airbnb careers page and extract job data
2. **Change Detection**: Compares current jobs with previously seen jobs
3. **Notifications**: Sends alerts through configured channels for new positions
4. **Persistence**: Saves job state between runs to avoid duplicates
5. **Scheduling**: Runs automatically on configured intervals

## 📋 Requirements

- Node.js 14+
- Internet connection
- Optional: Email account, Discord server, or Telegram bot (depending on notification method)

## 🎯 Perfect For

- Job seekers tracking Airbnb openings
- Recruiters monitoring new positions
- Anyone wanting automated job alerts
- Learning web scraping and automation
