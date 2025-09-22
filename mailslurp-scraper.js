require('dotenv').config();
const puppeteer = require('puppeteer');
const cron = require('node-cron');
const fs = require('fs').promises;
const crypto = require('crypto');
const EmailService = require('./email-service');

// Configuration
const config = {
    email: {
        enabled: process.env.EMAIL_ENABLED !== 'false', // Default enabled
        receiver: process.env.EMAIL_RECEIVER
    },
    scraping: {
        url: process.env.AIRBNB_JOBS_URL || 'https://careers.airbnb.com/positions/?_departments=engineering&_offices=bangalore-india',
        interval: process.env.SCRAPE_INTERVAL || '0 0 */2 * *', // Every 2 days at midnight
        keywords: process.env.JOB_KEYWORDS ? process.env.JOB_KEYWORDS.split(',').map(k => k.trim()) : ['Software', 'Backend']
    },
    files: {
        hashFile: './jobs-hash.txt',
        jobsFile: './latest-jobs.json',
        logFile: './scraper-log.json'
    }
};

// Initialize email service
let emailService = null;
if (config.email.enabled && config.email.receiver) {
    emailService = new EmailService();
}

/**
 * Generate SHA256 hash of jobs data for comparison
 */
function generateJobsHash(jobs) {
    const jobsString = JSON.stringify(jobs.map(job => ({
        title: job.title,
        link: job.link,
        department: job.department,
        location: job.location
    })).sort((a, b) => a.link.localeCompare(b.link))); // Sort for consistent hashing
    
    return crypto.createHash('sha256').update(jobsString).digest('hex');
}

/**
 * Load previous hash from file
 */
async function loadPreviousHash() {
    try {
        const hash = await fs.readFile(config.files.hashFile, 'utf8');
        return hash.trim();
    } catch (error) {
        console.log('📋 No previous hash found, treating as first run');
        return null;
    }
}

/**
 * Save hash to file
 */
async function saveHash(hash) {
    try {
        await fs.writeFile(config.files.hashFile, hash);
        console.log(`💾 Hash saved: ${hash.substring(0, 12)}...`);
    } catch (error) {
        console.error('❌ Error saving hash:', error);
    }
}

/**
 * Save jobs data to file
 */
async function saveJobs(jobs) {
    try {
        await fs.writeFile(config.files.jobsFile, JSON.stringify(jobs, null, 2));
        console.log(`💾 Saved ${jobs.length} jobs to ${config.files.jobsFile}`);
    } catch (error) {
        console.error('❌ Error saving jobs:', error);
    }
}

/**
 * Log scraper activity
 */
async function logActivity(activity) {
    try {
        const logEntry = {
            timestamp: new Date().toISOString(),
            ...activity
        };
        
        // Read existing logs
        let logs = [];
        try {
            const existingLogs = await fs.readFile(config.files.logFile, 'utf8');
            logs = JSON.parse(existingLogs);
        } catch (error) {
            // File doesn't exist, start with empty array
        }
        
        logs.push(logEntry);
        
        // Keep only last 100 entries
        if (logs.length > 100) {
            logs = logs.slice(-100);
        }
        
        await fs.writeFile(config.files.logFile, JSON.stringify(logs, null, 2));
    } catch (error) {
        console.error('❌ Error logging activity:', error);
    }
}

/**
 * Enhanced web scraping with better error handling
 */
async function scrapeJobs() {
    console.log('🔍 Starting job scraping...');
    
    const browser = await puppeteer.launch({
        headless: 'new',
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    });
    
    try {
        const page = await browser.newPage();
        
        // Set user agent and viewport
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1366, height: 768 });
        
        console.log(`📍 Navigating to: ${config.scraping.url}`);
        
        // Navigate with extended timeout
        await page.goto(config.scraping.url, { 
            waitUntil: 'networkidle2', 
            timeout: 90000 
        });
        
        // Wait for job listings to load
        await page.waitForSelector('.job-list', { timeout: 30000 });
        console.log('✅ Job listings found');
        
        // Extract job information with enhanced error handling
        const jobs = await page.evaluate(() => {
            const jobElements = document.querySelectorAll('.job-list li[role="listitem"]');
            const jobs = [];
            
            jobElements.forEach(job => {
                try {
                    const titleElement = job.querySelector('h3 a');
                    const departmentElement = job.querySelector('.text-gray-48');
                    const locationElement = job.querySelector('.col-span-4.lg\\:col-span-3 span');
                    
                    if (titleElement && titleElement.href) {
                        jobs.push({
                            title: titleElement.textContent.trim(),
                            link: titleElement.href,
                            department: departmentElement ? departmentElement.textContent.trim() : 'Engineering',
                            location: locationElement ? locationElement.textContent.trim() : 'Bangalore, India',
                            scraped_at: new Date().toISOString()
                        });
                    }
                } catch (error) {
                    console.error('Error parsing job element:', error);
                }
            });
            
            return jobs;
        });
        
        console.log(`✅ Successfully scraped ${jobs.length} jobs`);
        return jobs;
        
    } catch (error) {
        console.error('❌ Error during scraping:', error);
        
        // Take screenshot for debugging
        try {
            await page.screenshot({ path: `debug-${Date.now()}.png` });
            console.log('📸 Debug screenshot saved');
        } catch (screenshotError) {
            console.log('Could not save debug screenshot');
        }
        
        throw error;
    } finally {
        await browser.close();
    }
}

/**
 * Filter jobs by keywords and check if email should be sent
 */
function shouldSendEmail(jobs, keywords) {
    if (!keywords || keywords.length === 0) {
        return { shouldSend: true, matchingJobs: jobs, reason: 'no_keywords_filter' };
    }
    
    const matchingJobs = jobs.filter(job => {
        const searchText = `${job.title} ${job.department}`.toLowerCase();
        return keywords.some(keyword => searchText.includes(keyword.toLowerCase()));
    });
    
    if (matchingJobs.length === 0) {
        return { shouldSend: false, matchingJobs: [], reason: 'no_keyword_matches' };
    }
    
    return { shouldSend: true, matchingJobs, reason: 'keyword_matches_found' };
}

/**
 * Main job checking function
 */
async function checkForJobs() {
    const startTime = new Date();
    console.log(`\n🚀 Starting job check at ${startTime.toLocaleString()}`);
    console.log(`🔑 Keywords: ${config.scraping.keywords.join(', ')}`);
    
    try {
        // Scrape current jobs
        const currentJobs = await scrapeJobs();
        
        if (currentJobs.length === 0) {
            console.log('⚠️ No jobs found - this might indicate a scraping issue');
            await logActivity({
                action: 'scrape_completed',
                jobsCount: 0,
                status: 'warning',
                message: 'No jobs found'
            });
            return;
        }
        
        // Generate hash of current jobs
        const currentHash = generateJobsHash(currentJobs);
        console.log(`🔐 Current jobs hash: ${currentHash.substring(0, 12)}...`);
        
        // Load previous hash
        const previousHash = await loadPreviousHash();
        console.log(`🔐 Previous hash: ${previousHash ? previousHash.substring(0, 12) + '...' : 'None'}`);
        
        // Check if jobs have changed
        const jobsChanged = currentHash !== previousHash;
        
        if (!jobsChanged) {
            console.log('😴 No changes detected in job listings');
            await logActivity({
                action: 'check_completed',
                jobsCount: currentJobs.length,
                status: 'no_changes',
                hash: currentHash.substring(0, 12)
            });
            return;
        }
        
        console.log('✨ Jobs have changed! Checking keywords...');
        
        // Check if we should send email based on keywords
        const emailCheck = shouldSendEmail(currentJobs, config.scraping.keywords);
        
        if (!emailCheck.shouldSend) {
            console.log(`📧 No email sent: ${emailCheck.reason}`);
            await saveHash(currentHash);
            await saveJobs(currentJobs);
            await logActivity({
                action: 'check_completed',
                jobsCount: currentJobs.length,
                status: 'no_email',
                reason: emailCheck.reason,
                hash: currentHash.substring(0, 12)
            });
            return;
        }
        
        console.log(`📧 Found ${emailCheck.matchingJobs.length} matching job(s)!`);
        
        // Send email notification
        if (emailService) {
            console.log('📧 Sending email notification...');
            const emailResult = await emailService.sendJobAlert(emailCheck.matchingJobs, config.scraping.keywords);
            
            if (emailResult.success) {
                console.log('✅ Email sent successfully!');
                await logActivity({
                    action: 'email_sent',
                    jobsCount: currentJobs.length,
                    matchingJobsCount: emailCheck.matchingJobs.length,
                    emailId: emailResult.emailId,
                    status: 'success',
                    hash: currentHash.substring(0, 12)
                });
            } else {
                console.error('❌ Email sending failed:', emailResult.error);
                await logActivity({
                    action: 'email_failed',
                    jobsCount: currentJobs.length,
                    matchingJobsCount: emailCheck.matchingJobs.length,
                    error: emailResult.error,
                    status: 'error',
                    hash: currentHash.substring(0, 12)
                });
            }
        } else {
            console.log('📧 Email service not configured, skipping email');
        }
        
        // Save new hash and jobs
        await saveHash(currentHash);
        await saveJobs(currentJobs);
        
        // Display matching jobs in console
        console.log('\n📋 Matching Jobs:');
        emailCheck.matchingJobs.forEach((job, index) => {
            console.log(`\n${index + 1}. ${job.title}`);
            console.log(`   Department: ${job.department}`);
            console.log(`   Location: ${job.location}`);
            console.log(`   Link: ${job.link}`);
        });
        
    } catch (error) {
        console.error('💥 Error during job check:', error);
        await logActivity({
            action: 'check_failed',
            error: error.message,
            status: 'error'
        });
    }
    
    const endTime = new Date();
    const duration = (endTime - startTime) / 1000;
    console.log(`\n⏱️ Job check completed in ${duration.toFixed(2)} seconds\n`);
}

/**
 * Schedule regular job checks
 */
function scheduleJobChecks() {
    console.log(`⏰ Scheduling job checks with pattern: ${config.scraping.interval}`);
    console.log('   (Every 2 days at midnight by default)');
    
    cron.schedule(config.scraping.interval, async () => {
        console.log('\n⏰ Scheduled job check triggered');
        await checkForJobs();
    });
}

/**
 * Test email functionality
 */
async function testEmail() {
    if (!emailService) {
        console.log('❌ Email service not configured');
        return;
    }
    
    console.log('🧪 Testing email service...');
    const result = await emailService.testEmailService();
    
    if (result.success) {
        console.log('✅ Email test successful!');
    } else {
        console.error('❌ Email test failed:', result.error);
    }
}

/**
 * Graceful shutdown
 */
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    await logActivity({
        action: 'shutdown',
        status: 'manual'
    });
    process.exit(0);
});

/**
 * Main startup function
 */
async function start() {
    console.log('🚀 Starting Airbnb Job Scraper with MailSlurp');
    console.log('================================================');
    console.log(`📧 Email enabled: ${config.email.enabled}`);
    console.log(`📧 Receiver: ${config.email.receiver || 'Not configured'}`);
    console.log(`🔑 Keywords: ${config.scraping.keywords.join(', ')}`);
    console.log(`🌐 Target URL: ${config.scraping.url}`);
    console.log(`⏰ Schedule: ${config.scraping.interval}`);
    console.log('================================================\n');
    
    // Initialize email service if configured
    if (emailService) {
        try {
            await emailService.initialize();
            console.log('✅ Email service initialized successfully\n');
        } catch (error) {
            console.error('❌ Email service initialization failed:', error);
            console.log('📧 Continuing without email notifications\n');
            emailService = null;
        }
    }
    
    // Log startup
    await logActivity({
        action: 'startup',
        config: {
            emailEnabled: config.email.enabled,
            keywords: config.scraping.keywords,
            schedule: config.scraping.interval
        },
        status: 'success'
    });
    
    // Run initial check
    await checkForJobs();
    
    // Schedule future checks
    scheduleJobChecks();
    
    console.log('✅ Scraper is now running!');
    console.log('   Press Ctrl+C to stop');
    console.log('   Check scraper-log.json for detailed logs\n');
}

// Handle command line arguments
const args = process.argv.slice(2);

if (args.includes('--test-email')) {
    testEmail().then(() => process.exit(0));
} else if (args.includes('--run-once')) {
    checkForJobs().then(() => process.exit(0));
} else {
    start();
}
