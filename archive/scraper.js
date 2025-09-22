require('dotenv').config();
const puppeteer = require('puppeteer');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const fs = require('fs').promises;
const path = require('path');

// Store previously seen jobs
let previousJobs = new Set();

// Configure email transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

async function scrapeJobs() {
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox']
    });
    
    try {
        const page = await browser.newPage();
        
        // Navigate to Airbnb careers page with filters
        await page.goto(process.env.AIRBNB_JOBS_URL || 'https://careers.airbnb.com/positions/?_departments=engineering&_offices=bangalore-india');
        
        // Wait for job listings to load
        await page.waitForSelector('.job-list');
        
        // Extract job information
        const jobs = await page.evaluate(() => {
            const jobElements = document.querySelectorAll('.job-list li');
            return Array.from(jobElements).map(job => {
                const title = job.querySelector('h3 a').textContent.trim();
                const link = job.querySelector('h3 a').href;
                const department = job.querySelector('.text-gray-48').textContent.trim();
                const location = job.querySelector('.col-span-4.lg\\:col-span-3 span').textContent.trim();
                
                return {
                    title,
                    link,
                    department,
                    location
                };
            });
        });

        return jobs;
    } catch (error) {
        console.error('Error scraping jobs:', error);
        throw error;
    } finally {
        await browser.close();
    }
}

async function sendEmailNotification(newJobs) {
    const emailHtml = `
        <h2>New Airbnb Job Openings</h2>
        <p>The following new positions are available:</p>
        ${newJobs.map(job => `
            <div style="margin-bottom: 20px;">
                <h3><a href="${job.link}">${job.title}</a></h3>
                <p>Department: ${job.department}</p>
                <p>Location: ${job.location}</p>
            </div>
        `).join('')}
    `;

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_TO,
        subject: 'New Airbnb Job Openings Alert',
        html: emailHtml
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Email notification sent successfully');
    } catch (error) {
        console.error('Error sending email:', error);
    }
}

async function checkForNewJobs() {
    try {
        const currentJobs = await scrapeJobs();
        
        // Convert current jobs to strings for comparison
        const currentJobStrings = currentJobs.map(job => job.link);
        
        // Find new jobs
        const newJobs = currentJobs.filter(job => !previousJobs.has(job.link));
        
        if (newJobs.length > 0) {
            console.log(`Found ${newJobs.length} new jobs`);
            await sendEmailNotification(newJobs);
            
            // Update previous jobs
            previousJobs = new Set(currentJobStrings);
        } else {
            console.log('No new jobs found');
        }
    } catch (error) {
        console.error('Error checking for new jobs:', error);
    }
}

// Schedule job checks
const scheduleJobs = () => {
    const cronSchedule = process.env.SCRAPE_INTERVAL || '*/30 * * * *';
    console.log(`Scheduling job checks with cron pattern: ${cronSchedule}`);
    
    cron.schedule(cronSchedule, () => {
        console.log('Running scheduled job check...');
        checkForNewJobs();
    });
};

// Initial check and start scheduling
console.log('Starting Airbnb job scraper...');
checkForNewJobs().then(() => {
    scheduleJobs();
});
