require('dotenv').config();
const puppeteer = require('puppeteer');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const fs = require('fs').promises;
const path = require('path');

// Store previously seen jobs
let previousJobs = new Set();

// Configuration with multiple notification options
const config = {
    email: {
        enabled: process.env.EMAIL_ENABLED === 'true',
        service: process.env.EMAIL_SERVICE || 'gmail',
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
        to: process.env.EMAIL_TO
    },
    webhook: {
        enabled: process.env.WEBHOOK_ENABLED === 'true',
        url: process.env.WEBHOOK_URL
    },
    discord: {
        enabled: process.env.DISCORD_ENABLED === 'true',
        webhookUrl: process.env.DISCORD_WEBHOOK_URL
    },
    telegram: {
        enabled: process.env.TELEGRAM_ENABLED === 'true',
        botToken: process.env.TELEGRAM_BOT_TOKEN,
        chatId: process.env.TELEGRAM_CHAT_ID
    },
    console: {
        enabled: process.env.CONSOLE_ENABLED !== 'false' // Default to true
    },
    fileLog: {
        enabled: process.env.FILE_LOG_ENABLED === 'true',
        path: process.env.LOG_FILE_PATH || './job-alerts.log'
    }
};

// Initialize email transporter if enabled
let transporter = null;
if (config.email.enabled && config.email.user && config.email.pass) {
    transporter = nodemailer.createTransporter({
        service: config.email.service,
        auth: {
            user: config.email.user,
            pass: config.email.pass
        }
    });
}

async function scrapeJobs() {
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
        const page = await browser.newPage();
        
        // Set user agent to avoid detection
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        
        // Navigate to Airbnb careers page with filters
        const url = process.env.AIRBNB_JOBS_URL || 'https://careers.airbnb.com/positions/?_departments=engineering&_offices=bangalore-india';
        console.log(`Navigating to: ${url}`);
        
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        
        // Wait for job listings to load
        await page.waitForSelector('.job-list', { timeout: 30000 });
        
        // Extract job information
        const jobs = await page.evaluate(() => {
            const jobElements = document.querySelectorAll('.job-list li[role="listitem"]');
            return Array.from(jobElements).map(job => {
                try {
                    const titleElement = job.querySelector('h3 a');
                    const departmentElement = job.querySelector('.text-gray-48');
                    const locationElement = job.querySelector('.col-span-4.lg\\:col-span-3 span');
                    
                    return {
                        title: titleElement ? titleElement.textContent.trim() : 'N/A',
                        link: titleElement ? titleElement.href : '',
                        department: departmentElement ? departmentElement.textContent.trim() : 'N/A',
                        location: locationElement ? locationElement.textContent.trim() : 'N/A',
                        scraped_at: new Date().toISOString()
                    };
                } catch (error) {
                    console.error('Error parsing job element:', error);
                    return null;
                }
            }).filter(job => job && job.link);
        });

        console.log(`Scraped ${jobs.length} jobs`);
        return jobs;
    } catch (error) {
        console.error('Error scraping jobs:', error);
        throw error;
    } finally {
        await browser.close();
    }
}

async function sendEmailNotification(newJobs) {
    if (!transporter || !config.email.to) {
        console.log('Email not configured, skipping email notification');
        return;
    }

    const emailHtml = `
        <h2>🚀 New Airbnb Job Openings Alert!</h2>
        <p>Found ${newJobs.length} new position(s) in Engineering at Bangalore, India:</p>
        <div style="margin: 20px 0;">
            ${newJobs.map(job => `
                <div style="border: 1px solid #ddd; margin: 15px 0; padding: 15px; border-radius: 5px;">
                    <h3 style="margin: 0 0 10px 0; color: #FF5A5F;">
                        <a href="${job.link}" style="color: #FF5A5F; text-decoration: none;">${job.title}</a>
                    </h3>
                    <p style="margin: 5px 0;"><strong>Department:</strong> ${job.department}</p>
                    <p style="margin: 5px 0;"><strong>Location:</strong> ${job.location}</p>
                    <p style="margin: 5px 0;"><strong>Apply:</strong> <a href="${job.link}">Click here</a></p>
                </div>
            `).join('')}
        </div>
        <p style="color: #666; font-size: 12px;">Scraped at: ${new Date().toLocaleString()}</p>
    `;

    const mailOptions = {
        from: config.email.user,
        to: config.email.to,
        subject: `🔔 ${newJobs.length} New Airbnb Job(s) Available!`,
        html: emailHtml
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('✅ Email notification sent successfully');
    } catch (error) {
        console.error('❌ Error sending email:', error);
    }
}

async function sendDiscordNotification(newJobs) {
    if (!config.discord.enabled || !config.discord.webhookUrl) {
        return;
    }

    const fetch = (await import('node-fetch')).default;
    
    const embed = {
        title: "🚀 New Airbnb Job Openings!",
        description: `Found ${newJobs.length} new engineering position(s) in Bangalore`,
        color: 0xFF5A5F,
        fields: newJobs.slice(0, 10).map(job => ({
            name: job.title,
            value: `**Department:** ${job.department}\n**Location:** ${job.location}\n[Apply Here](${job.link})`,
            inline: false
        })),
        timestamp: new Date().toISOString()
    };

    try {
        await fetch(config.discord.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embeds: [embed] })
        });
        console.log('✅ Discord notification sent successfully');
    } catch (error) {
        console.error('❌ Error sending Discord notification:', error);
    }
}

async function sendTelegramNotification(newJobs) {
    if (!config.telegram.enabled || !config.telegram.botToken || !config.telegram.chatId) {
        return;
    }

    const fetch = (await import('node-fetch')).default;
    
    const message = `🚀 *New Airbnb Job Openings!*\n\nFound ${newJobs.length} new engineering position(s) in Bangalore:\n\n` +
        newJobs.map(job => `📝 *${job.title}*\n🏢 ${job.department}\n📍 ${job.location}\n🔗 [Apply Here](${job.link})\n`).join('\n');

    try {
        await fetch(`https://api.telegram.org/bot${config.telegram.botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: config.telegram.chatId,
                text: message,
                parse_mode: 'Markdown',
                disable_web_page_preview: true
            })
        });
        console.log('✅ Telegram notification sent successfully');
    } catch (error) {
        console.error('❌ Error sending Telegram notification:', error);
    }
}

async function sendWebhookNotification(newJobs) {
    if (!config.webhook.enabled || !config.webhook.url) {
        return;
    }

    const fetch = (await import('node-fetch')).default;
    
    const payload = {
        event: 'new_jobs',
        timestamp: new Date().toISOString(),
        jobs: newJobs,
        count: newJobs.length
    };

    try {
        await fetch(config.webhook.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        console.log('✅ Webhook notification sent successfully');
    } catch (error) {
        console.error('❌ Error sending webhook notification:', error);
    }
}

async function logToFile(newJobs) {
    if (!config.fileLog.enabled) {
        return;
    }

    const logEntry = {
        timestamp: new Date().toISOString(),
        count: newJobs.length,
        jobs: newJobs
    };

    try {
        await fs.appendFile(config.fileLog.path, JSON.stringify(logEntry) + '\n');
        console.log('✅ Jobs logged to file successfully');
    } catch (error) {
        console.error('❌ Error writing to log file:', error);
    }
}

async function sendNotifications(newJobs) {
    const notifications = [];

    // Console notification (always enabled unless explicitly disabled)
    if (config.console.enabled) {
        console.log('\n🎉 NEW JOBS FOUND!');
        newJobs.forEach((job, index) => {
            console.log(`\n${index + 1}. ${job.title}`);
            console.log(`   Department: ${job.department}`);
            console.log(`   Location: ${job.location}`);
            console.log(`   Link: ${job.link}`);
        });
        console.log('\n');
    }

    // Send all notifications in parallel
    if (config.email.enabled) notifications.push(sendEmailNotification(newJobs));
    if (config.discord.enabled) notifications.push(sendDiscordNotification(newJobs));
    if (config.telegram.enabled) notifications.push(sendTelegramNotification(newJobs));
    if (config.webhook.enabled) notifications.push(sendWebhookNotification(newJobs));
    if (config.fileLog.enabled) notifications.push(logToFile(newJobs));

    await Promise.allSettled(notifications);
}

async function checkForNewJobs() {
    try {
        console.log(`🔍 Checking for new jobs at ${new Date().toLocaleString()}...`);
        const currentJobs = await scrapeJobs();
        
        if (currentJobs.length === 0) {
            console.log('⚠️ No jobs found - this might indicate a scraping issue');
            return;
        }

        // Find new jobs
        const newJobs = currentJobs.filter(job => !previousJobs.has(job.link));
        
        if (newJobs.length > 0) {
            console.log(`✨ Found ${newJobs.length} new job(s)!`);
            await sendNotifications(newJobs);
            
            // Update previous jobs
            previousJobs = new Set(currentJobs.map(job => job.link));
        } else {
            console.log('😴 No new jobs found');
        }

        console.log(`📊 Total jobs tracked: ${currentJobs.length}`);
    } catch (error) {
        console.error('💥 Error checking for new jobs:', error);
    }
}

// Load previously seen jobs from file if exists
async function loadPreviousJobs() {
    try {
        const data = await fs.readFile('./previous-jobs.json', 'utf8');
        const jobs = JSON.parse(data);
        previousJobs = new Set(jobs);
        console.log(`📋 Loaded ${jobs.length} previously seen jobs`);
    } catch (error) {
        console.log('📋 No previous jobs file found, starting fresh');
    }
}

// Save current jobs to file
async function savePreviousJobs() {
    try {
        await fs.writeFile('./previous-jobs.json', JSON.stringify([...previousJobs]));
    } catch (error) {
        console.error('Error saving previous jobs:', error);
    }
}

// Schedule job checks
const scheduleJobs = () => {
    const cronSchedule = process.env.SCRAPE_INTERVAL || '0 */30 * * * *'; // Every 30 minutes
    console.log(`⏰ Scheduling job checks with cron pattern: ${cronSchedule}`);
    
    cron.schedule(cronSchedule, async () => {
        await checkForNewJobs();
        await savePreviousJobs();
    });
};

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    await savePreviousJobs();
    process.exit(0);
});

// Initial setup and start
async function start() {
    console.log('🚀 Starting Enhanced Airbnb Job Scraper...');
    console.log('📋 Enabled notifications:');
    if (config.console.enabled) console.log('  ✅ Console');
    if (config.email.enabled) console.log('  ✅ Email');
    if (config.discord.enabled) console.log('  ✅ Discord');
    if (config.telegram.enabled) console.log('  ✅ Telegram');
    if (config.webhook.enabled) console.log('  ✅ Webhook');
    if (config.fileLog.enabled) console.log('  ✅ File Log');
    
    await loadPreviousJobs();
    await checkForNewJobs();
    await savePreviousJobs();
    scheduleJobs();
    
    console.log('✅ Scraper is now running! Press Ctrl+C to stop.');
}

start();
