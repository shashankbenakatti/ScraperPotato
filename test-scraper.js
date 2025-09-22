// Simple test script to verify the scraper works
require('dotenv').config();
const puppeteer = require('puppeteer');

async function testScraper() {
    console.log('🧪 Testing Airbnb job scraper...\n');
    
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
        const page = await browser.newPage();
        
        // Set user agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        
        const url = process.env.AIRBNB_JOBS_URL || 'https://careers.airbnb.com/positions/?_departments=engineering&_offices=bangalore-india';
        console.log(`📍 Navigating to: ${url}`);
        
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        console.log('✅ Page loaded successfully');
        
        // Wait for job listings
        await page.waitForSelector('.job-list', { timeout: 30000 });
        console.log('✅ Job list found');
        
        // Extract jobs
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
                        location: locationElement ? locationElement.textContent.trim() : 'N/A'
                    };
                } catch (error) {
                    return null;
                }
            }).filter(job => job && job.link);
        });
        
        console.log(`\n🎉 Success! Found ${jobs.length} job(s):\n`);
        
        jobs.forEach((job, index) => {
            console.log(`${index + 1}. ${job.title}`);
            console.log(`   Department: ${job.department}`);
            console.log(`   Location: ${job.location}`);
            console.log(`   Link: ${job.link}\n`);
        });
        
        if (jobs.length === 0) {
            console.log('⚠️  No jobs found. This might indicate:');
            console.log('   - No current openings matching the criteria');
            console.log('   - Website structure has changed');
            console.log('   - Rate limiting or blocking');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        
        // Take a screenshot for debugging
        try {
            await page.screenshot({ path: 'debug-screenshot.png' });
            console.log('📸 Debug screenshot saved as debug-screenshot.png');
        } catch (screenshotError) {
            console.log('Could not save screenshot');
        }
    } finally {
        await browser.close();
    }
}

// Run the test
testScraper()
    .then(() => {
        console.log('✅ Test completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Test failed:', error);
        process.exit(1);
    });
