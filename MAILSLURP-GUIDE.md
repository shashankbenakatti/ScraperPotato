# 📧 MailSlurp Job Scraper Guide

This is a customized version of the Airbnb job scraper that uses MailSlurp for email notifications, SHA256 hash comparison to detect changes, and keyword filtering.

## 🚀 Key Features

- **MailSlurp Integration**: Professional email service with better deliverability
- **SHA256 Hash Comparison**: Only sends emails when job listings actually change
- **Keyword Filtering**: Only get notified about jobs that match your interests
- **Beautiful HTML Emails**: Rich formatting with job cards and apply buttons
- **Smart Scheduling**: Runs every 2 days by default (configurable)
- **Detailed Logging**: Tracks all activities in JSON format
- **Separate Email Module**: Clean code architecture

## 📁 New Files Created

- `mailslurp-scraper.js` - Main scraper with MailSlurp integration
- `email-service.js` - Separate email service module
- `env-template.txt` - Configuration template
- `MAILSLURP-GUIDE.md` - This documentation

## 🔧 Setup Instructions

### 1. Create Environment Configuration

Copy `env-template.txt` to `.env` and update the values:

```bash
cp env-template.txt .env
```

### 2. Configure Your Settings

Edit `.env` file:

```bash
# Your MailSlurp API key (provided)
MAILSLURP_API_KEY=c18e5e0c61756ce583cd95c9a4b72a5d0e449ac30aba96e65183bef2f53d116d

# Where to send job alerts
EMAIL_RECEIVER=your-email@example.com

# Keywords to filter jobs (comma-separated)
JOB_KEYWORDS=Software,Backend,Senior,Lead,Full Stack

# Schedule (every 2 days at midnight)
SCRAPE_INTERVAL=0 0 0 */2 * *
```

### 3. Test Email Service

```bash
npm run test-email
```

This will:
- Initialize MailSlurp
- Create/verify inbox
- Send a test email
- Confirm everything works

### 4. Run One-Time Check

```bash
npm run run-once
```

This will:
- Scrape current jobs
- Apply keyword filtering
- Show what would be emailed
- Create initial hash file

### 5. Start Continuous Monitoring

```bash
npm run mailslurp
```

This will:
- Run initial check
- Schedule future checks every 2 days
- Send emails only when new matching jobs appear

## 📋 Available Commands

```bash
npm run mailslurp      # Start the MailSlurp scraper
npm run test-email     # Test email functionality
npm run run-once       # Single check without scheduling
```

## 🔐 How SHA256 Hash Works

1. **First Run**: Creates hash of all job listings → saves to `jobs-hash.txt`
2. **Subsequent Runs**: 
   - Scrapes current jobs
   - Generates hash of current jobs
   - Compares with previous hash
   - **Only sends email if hash is different**

This ensures you only get notified when jobs actually change, not every time the scraper runs.

## 🔑 Keyword Filtering

The scraper searches for keywords in:
- Job titles
- Department names

**Example**: If your keywords are `Software,Backend,Senior`, it will match:
- "Senior Software Engineer"
- "Backend Developer" 
- "Software Engineering Manager"
- But NOT "Marketing Manager" or "Sales Associate"

### Default Keywords
```
Software, Backend, Frontend, Full Stack, DevOps, Data, 
Machine Learning, AI, Cloud, Senior, Lead, Principal
```

## 📧 Email Features

### Rich HTML Formatting
- Professional layout with Airbnb colors
- Individual job cards with details
- Clickable apply buttons
- Keywords that triggered the alert
- Statistics summary

### Smart Subject Lines
```
🔔 3 New Airbnb Jobs - Senior Software Engineer, Backend Developer...
```

### Content Includes
- Job title (clickable link)
- Department and location
- Matched keywords highlighted
- Direct apply button
- Timestamp of when scraped

## 📊 Logging & Monitoring

### Files Created
- `jobs-hash.txt` - Current hash for comparison
- `latest-jobs.json` - Last scraped job data
- `scraper-log.json` - Detailed activity log

### Log Entries Track
- Scraping attempts and results
- Hash comparisons
- Email sending success/failure
- Keyword matches
- System startup/shutdown

## ⏰ Scheduling Options

Default: Every 2 days at midnight
```bash
SCRAPE_INTERVAL=0 0 0 */2 * *
```

Other examples:
```bash
# Every day at 9 AM
SCRAPE_INTERVAL=0 0 9 * * *

# Every Monday and Friday at 9 AM
SCRAPE_INTERVAL=0 0 9 * * 1,5

# Every 6 hours
SCRAPE_INTERVAL=0 0 */6 * * *

# Every hour (for testing)
SCRAPE_INTERVAL=0 0 * * * *
```

## 🛠 Troubleshooting

### Email Not Sending
1. Check MailSlurp API key in `.env`
2. Verify EMAIL_RECEIVER is correct
3. Run `npm run test-email` to diagnose
4. Check console for error messages

### No Jobs Found
1. Verify AIRBNB_JOBS_URL is accessible
2. Check if website structure changed
3. Look for debug screenshots in project folder

### Keywords Not Matching
1. Check keyword spelling in `.env`
2. Keywords are case-insensitive
3. Use broader terms (e.g., "Software" vs "Software Engineer")

### Hash Issues
1. Delete `jobs-hash.txt` to reset
2. Run `npm run run-once` to recreate

## 🔍 Architecture

### Separation of Concerns
- `mailslurp-scraper.js` - Core logic, scheduling, hash comparison
- `email-service.js` - Email handling, HTML generation, MailSlurp API
- Clean imports and modular design

### Error Handling
- Graceful failures don't stop the scraper
- Detailed error logging
- Debug screenshots on scraping errors
- Email fallbacks if MailSlurp fails

### Security
- API keys in environment variables
- No hardcoded credentials
- Secure hash generation

## 📈 Advantages Over Basic Version

1. **No Spam**: Only emails when jobs actually change
2. **Relevant Jobs**: Keyword filtering reduces noise
3. **Professional Emails**: Better formatting and deliverability
4. **Better Monitoring**: Detailed logs and status tracking
5. **Flexible Scheduling**: Easy to adjust timing
6. **Production Ready**: Robust error handling and recovery

## 🎯 Perfect For

- Job seekers who want targeted alerts
- Professionals tracking specific roles
- Anyone wanting clean, actionable notifications
- Users who need reliable, non-spammy job alerts

Start with `npm run test-email` to verify your setup, then `npm run mailslurp` to begin monitoring!
