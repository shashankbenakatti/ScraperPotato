/**
 * Cloudflare Workers Airbnb Job Scraper
 * Adapted from mailslurp-scraper.js for Workers environment
 */

import { WorkerEmailService } from './worker-email-service.js';

// Default configuration
const DEFAULT_CONFIG = {
    scraping: {
        url: 'https://careers.airbnb.com/positions/?_departments=engineering&_offices=bangalore-india',
        keywords: ['Software', 'Backend', 'Frontend', 'Full Stack', 'DevOps', 'Data', 'Machine Learning', 'AI', 'Cloud', 'Senior', 'Lead', 'Principal']
    }
};

/**
 * Generate SHA256 hash of jobs data for comparison
 */
async function generateJobsHash(jobs) {
    const jobsString = JSON.stringify(jobs.map(job => ({
        title: job.title,
        link: job.link,
        department: job.department,
        location: job.location
    })).sort((a, b) => a.link.localeCompare(b.link)));
    
    const encoder = new TextEncoder();
    const data = encoder.encode(jobsString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Scrape jobs from Airbnb careers page
 */
async function scrapeJobs(url) {
    console.log('🔍 Starting job scraping...');
    console.log(`📍 Navigating to: ${url}`);
    
    try {
        // Fetch the page
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch page: ${response.statusText}`);
        }
        
        const html = await response.text();
        
        // Parse HTML and extract jobs
        // Note: In Workers, we need to use HTMLRewriter or regex parsing
        // For simplicity, using regex patterns to extract job data
        const jobs = extractJobsFromHTML(html);
        
        console.log(`✅ Successfully scraped ${jobs.length} jobs`);
        return jobs;
        
    } catch (error) {
        console.error('❌ Error during scraping:', error);
        throw error;
    }
}

/**
 * Extract job information from HTML using regex patterns
 * Note: This is a simplified approach for Workers environment
 */
function extractJobsFromHTML(html) {
    const jobs = [];
    
    // Pattern to match job listings
    const jobPattern = /<li[^>]*role="listitem"[^>]*>(.*?)<\/li>/gs;
    const titlePattern = /<h3[^>]*>.*?<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/s;
    const departmentPattern = /<span[^>]*text-gray-48[^>]*>([^<]*)</s;
    const locationPattern = /<span[^>]*col-span-4[^>]*lg:col-span-3[^>]*>.*?<span[^>]*>([^<]*)</s;
    
    let jobMatch;
    while ((jobMatch = jobPattern.exec(html)) !== null) {
        const jobHtml = jobMatch[1];
        
        const titleMatch = titlePattern.exec(jobHtml);
        const departmentMatch = departmentPattern.exec(jobHtml);
        const locationMatch = locationPattern.exec(jobHtml);
        
        if (titleMatch && titleMatch[1] && titleMatch[2]) {
            jobs.push({
                title: titleMatch[2].trim(),
                link: titleMatch[1],
                department: departmentMatch ? departmentMatch[1].trim() : 'Engineering',
                location: locationMatch ? locationMatch[1].trim() : 'Bangalore, India',
                scraped_at: new Date().toISOString()
            });
        }
    }
    
    return jobs;
}

/**
 * Filter jobs by keywords
 */
function filterJobsByKeywords(jobs, keywords) {
    if (!keywords || keywords.length === 0) {
        return jobs;
    }

    return jobs.filter(job => {
        const searchText = `${job.title} ${job.department}`.toLowerCase();
        return keywords.some(keyword => searchText.includes(keyword.toLowerCase()));
    });
}

/**
 * Main job checking function
 */
async function checkForJobs(env) {
    const startTime = new Date();
    console.log(`🚀 Starting job check at ${startTime.toISOString()}`);
    
    try {
        // Get configuration from environment
        const config = {
            scraping: {
                url: env.AIRBNB_JOBS_URL || DEFAULT_CONFIG.scraping.url,
                keywords: env.JOB_KEYWORDS ? env.JOB_KEYWORDS.split(',').map(k => k.trim()) : DEFAULT_CONFIG.scraping.keywords
            },
            email: {
                enabled: env.EMAIL_ENABLED !== 'false',
                receiver: env.EMAIL_RECEIVER
            }
        };
        
        console.log(`🔑 Keywords: ${config.scraping.keywords.join(', ')}`);
        
        // Scrape current jobs
        const currentJobs = await scrapeJobs(config.scraping.url);
        
        if (currentJobs.length === 0) {
            console.log('⚠️ No jobs found - this might indicate a scraping issue');
            return { success: false, message: 'No jobs found' };
        }
        
        // Generate hash of current jobs
        const currentHash = await generateJobsHash(currentJobs);
        console.log(`🔐 Current jobs hash: ${currentHash.substring(0, 12)}...`);
        
        // Get previous hash from KV storage
        const previousHash = await env.JOB_STORAGE.get('jobs-hash');
        console.log(`🔐 Previous hash: ${previousHash ? previousHash.substring(0, 12) + '...' : 'None'}`);
        
        // Check if jobs have changed
        const jobsChanged = currentHash !== previousHash;
        
        if (!jobsChanged) {
            console.log('😴 No changes detected in job listings');
            return { success: true, message: 'No changes detected' };
        }
        
        console.log('✨ Jobs have changed! Checking keywords...');
        
        // Filter jobs by keywords
        const matchingJobs = filterJobsByKeywords(currentJobs, config.scraping.keywords);
        
        if (matchingJobs.length === 0) {
            console.log('📧 No jobs match keywords, saving hash but not sending email');
            await env.JOB_STORAGE.put('jobs-hash', currentHash);
            await env.JOB_STORAGE.put('latest-jobs', JSON.stringify(currentJobs));
            return { success: true, message: 'No matching jobs found' };
        }
        
        console.log(`📧 Found ${matchingJobs.length} matching job(s)!`);
        
        // Send email notification if enabled
        if (config.email.enabled && config.email.receiver) {
            console.log('📧 Sending email notification...');
            const emailService = new WorkerEmailService(env);
            const emailResult = await emailService.sendJobAlert(matchingJobs, config.scraping.keywords);
            
            if (emailResult.success) {
                console.log('✅ Email sent successfully!');
            } else {
                console.error('❌ Email sending failed:', emailResult.error);
            }
        } else {
            console.log('📧 Email not configured, skipping email notification');
        }
        
        // Save new hash and jobs to KV storage
        await env.JOB_STORAGE.put('jobs-hash', currentHash);
        await env.JOB_STORAGE.put('latest-jobs', JSON.stringify(currentJobs));
        
        // Log activity
        const logEntry = {
            timestamp: new Date().toISOString(),
            action: 'jobs_found',
            jobsCount: currentJobs.length,
            matchingJobsCount: matchingJobs.length,
            hash: currentHash.substring(0, 12),
            jobs: matchingJobs.map(job => ({ title: job.title, link: job.link }))
        };
        
        // Store log (keep last 10 entries)
        const existingLogs = await env.JOB_STORAGE.get('activity-logs', { type: 'json' }) || [];
        const logs = [...existingLogs, logEntry].slice(-10);
        await env.JOB_STORAGE.put('activity-logs', JSON.stringify(logs));
        
        const endTime = new Date();
        const duration = (endTime - startTime) / 1000;
        console.log(`⏱️ Job check completed in ${duration.toFixed(2)} seconds`);
        
        return {
            success: true,
            message: 'Jobs processed successfully',
            matchingJobsCount: matchingJobs.length,
            totalJobsCount: currentJobs.length,
            jobs: matchingJobs
        };
        
    } catch (error) {
        console.error('💥 Error during job check:', error);
        
        // Log error
        const errorLog = {
            timestamp: new Date().toISOString(),
            action: 'error',
            error: error.message,
            stack: error.stack
        };
        
        try {
            const existingLogs = await env.JOB_STORAGE.get('activity-logs', { type: 'json' }) || [];
            const logs = [...existingLogs, errorLog].slice(-10);
            await env.JOB_STORAGE.put('activity-logs', JSON.stringify(logs));
        } catch (logError) {
            console.error('Failed to log error:', logError);
        }
        
        return { success: false, error: error.message };
    }
}

/**
 * Handle HTTP requests (for manual triggering and status)
 */
async function handleRequest(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    if (path === '/status') {
        // Return status and recent logs
        const logs = await env.JOB_STORAGE.get('activity-logs', { type: 'json' }) || [];
        const latestJobs = await env.JOB_STORAGE.get('latest-jobs', { type: 'json' }) || [];
        const currentHash = await env.JOB_STORAGE.get('jobs-hash') || 'None';
        
        return new Response(JSON.stringify({
            status: 'running',
            lastCheck: logs[logs.length - 1]?.timestamp || 'Never',
            currentHash: currentHash.substring(0, 12),
            jobsCount: latestJobs.length,
            recentLogs: logs.slice(-5),
            timestamp: new Date().toISOString()
        }, null, 2), {
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    if (path === '/trigger') {
        // Manual trigger
        console.log('🔨 Manual trigger initiated');
        const result = await checkForJobs(env);
        
        return new Response(JSON.stringify({
            triggered: true,
            result: result,
            timestamp: new Date().toISOString()
        }, null, 2), {
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    if (path === '/test-email') {
        // Test email functionality
        if (!env.EMAIL_RECEIVER) {
            return new Response(JSON.stringify({
                error: 'EMAIL_RECEIVER not configured'
            }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        
        try {
            const emailService = new WorkerEmailService(env);
            const result = await emailService.testEmailService();
            
            return new Response(JSON.stringify({
                testEmail: true,
                result: result,
                timestamp: new Date().toISOString()
            }, null, 2), {
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (error) {
            return new Response(JSON.stringify({
                error: error.message,
                timestamp: new Date().toISOString()
            }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
    }
    
    // Default response
    return new Response(`
    <html>
    <body>
        <h1>🚀 Airbnb Job Scraper</h1>
        <p>Running on Cloudflare Workers</p>
        <ul>
            <li><a href="/status">Status & Logs</a></li>
            <li><a href="/trigger">Manual Trigger</a></li>
            <li><a href="/test-email">Test Email</a></li>
        </ul>
        <p>Cron Schedule: Every 2 days at midnight UTC</p>
    </body>
    </html>
    `, {
        headers: { 'Content-Type': 'text/html' }
    });
}

// Worker event handlers
export default {
    // Handle scheduled events (cron triggers)
    async scheduled(event, env, ctx) {
        console.log('⏰ Scheduled job check triggered');
        ctx.waitUntil(checkForJobs(env));
    },
    
    // Handle HTTP requests
    async fetch(request, env, ctx) {
        return handleRequest(request, env);
    }
};
