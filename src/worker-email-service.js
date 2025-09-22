/**
 * MailSlurp Email Service for Cloudflare Workers
 * Adapted from the original email-service.js for Workers environment
 */

export class WorkerEmailService {
    constructor(env) {
        this.apiKey = env.MAILSLURP_API_KEY;
        this.senderEmail = env.MAILSLURP_SENDER_EMAIL;
        this.receiverEmail = env.EMAIL_RECEIVER;
        this.baseUrl = 'https://api.mailslurp.com';
        
        if (!this.apiKey) {
            throw new Error('MAILSLURP_API_KEY is required in environment variables');
        }
    }

    async initialize() {
        try {
            // Create or get inbox
            if (this.senderEmail) {
                // Use existing inbox
                const response = await fetch(`${this.baseUrl}/inboxes`, {
                    headers: {
                        'x-api-key': this.apiKey,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`Failed to fetch inboxes: ${response.statusText}`);
                }
                
                const inboxes = await response.json();
                this.inbox = inboxes.content.find(inbox => inbox.emailAddress === this.senderEmail);
                
                if (!this.inbox) {
                    throw new Error(`Inbox with email ${this.senderEmail} not found`);
                }
            } else {
                // Create new inbox
                const response = await fetch(`${this.baseUrl}/inboxes`, {
                    method: 'POST',
                    headers: {
                        'x-api-key': this.apiKey,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({})
                });
                
                if (!response.ok) {
                    throw new Error(`Failed to create inbox: ${response.statusText}`);
                }
                
                this.inbox = await response.json();
                console.log(`📧 Created new inbox: ${this.inbox.emailAddress}`);
            }
            
            console.log(`✅ Email service initialized with inbox: ${this.inbox.emailAddress}`);
            return this.inbox;
        } catch (error) {
            console.error('❌ Failed to initialize email service:', error);
            throw error;
        }
    }

    generateJobEmailHTML(jobs, keywords) {
        const matchingJobs = this.filterJobsByKeywords(jobs, keywords);
        
        if (matchingJobs.length === 0) {
            return null; // No matching jobs
        }

        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #FF5A5F, #FF8E90); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .header h1 { margin: 0; font-size: 28px; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .job-card { background: white; border-left: 4px solid #FF5A5F; margin: 20px 0; padding: 20px; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
                .job-title { color: #FF5A5F; font-size: 20px; font-weight: bold; margin: 0 0 10px 0; }
                .job-title a { color: #FF5A5F; text-decoration: none; }
                .job-title a:hover { text-decoration: underline; }
                .job-meta { color: #666; font-size: 14px; margin: 5px 0; }
                .job-meta strong { color: #333; }
                .keywords-matched { background: #e8f5e8; color: #2d5a2d; padding: 5px 10px; border-radius: 15px; font-size: 12px; display: inline-block; margin: 5px 5px 0 0; }
                .apply-btn { background: #FF5A5F; color: white; padding: 12px 25px; text-decoration: none; border-radius: 25px; display: inline-block; margin-top: 15px; font-weight: bold; }
                .apply-btn:hover { background: #e04347; }
                .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
                .stats { background: #fff; padding: 15px; border-radius: 5px; margin: 20px 0; text-align: center; }
                .stats-number { font-size: 24px; font-weight: bold; color: #FF5A5F; }
                .stats-label { color: #666; font-size: 14px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🚀 New Airbnb Job Opportunities</h1>
                    <p>Engineering positions matching your keywords</p>
                </div>
                
                <div class="content">
                    <div class="stats">
                        <div class="stats-number">${matchingJobs.length}</div>
                        <div class="stats-label">New Matching Position${matchingJobs.length > 1 ? 's' : ''} Found</div>
                    </div>
                    
                    <p><strong>Keywords that triggered this alert:</strong> ${keywords.join(', ')}</p>
                    
                    ${matchingJobs.map(job => {
                        const matchedKeywords = this.getMatchedKeywords(job, keywords);
                        return `
                        <div class="job-card">
                            <h2 class="job-title">
                                <a href="${job.link}" target="_blank">${job.title}</a>
                            </h2>
                            
                            <div class="job-meta">
                                <strong>Department:</strong> ${job.department}
                            </div>
                            <div class="job-meta">
                                <strong>Location:</strong> ${job.location}
                            </div>
                            <div class="job-meta">
                                <strong>Scraped:</strong> ${job.scraped_at ? new Date(job.scraped_at).toLocaleDateString() : 'Recently'}
                            </div>
                            
                            ${matchedKeywords.length > 0 ? `
                            <div style="margin: 10px 0;">
                                <strong>Matched Keywords:</strong><br>
                                ${matchedKeywords.map(keyword => `<span class="keywords-matched">${keyword}</span>`).join('')}
                            </div>
                            ` : ''}
                            
                            <a href="${job.link}" class="apply-btn" target="_blank">Apply Now →</a>
                        </div>
                        `;
                    }).join('')}
                    
                    <div class="footer">
                        <p>This email was generated automatically by your Cloudflare Workers Job Scraper</p>
                        <p>Scraped on ${new Date().toLocaleString()}</p>
                        <p style="color: #999;">Powered by Cloudflare Workers & MailSlurp</p>
                    </div>
                </div>
            </div>
        </body>
        </html>
        `;

        return html;
    }

    filterJobsByKeywords(jobs, keywords) {
        if (!keywords || keywords.length === 0) {
            return jobs;
        }

        return jobs.filter(job => {
            const searchText = `${job.title} ${job.department}`.toLowerCase();
            return keywords.some(keyword => 
                searchText.includes(keyword.toLowerCase())
            );
        });
    }

    getMatchedKeywords(job, keywords) {
        const searchText = `${job.title} ${job.department}`.toLowerCase();
        return keywords.filter(keyword => 
            searchText.includes(keyword.toLowerCase())
        );
    }

    async sendJobAlert(jobs, keywords) {
        try {
            if (!this.inbox || !this.inbox.id) {
                console.log('📧 Initializing inbox for email sending...');
                await this.initialize();
                
                if (!this.inbox || !this.inbox.id) {
                    throw new Error('Failed to initialize inbox - no inbox ID available');
                }
            }

            const emailHTML = this.generateJobEmailHTML(jobs, keywords);
            
            if (!emailHTML) {
                console.log('📧 No jobs match the specified keywords, skipping email');
                return { success: true, reason: 'no_matching_jobs' };
            }

            const matchingJobs = this.filterJobsByKeywords(jobs, keywords);
            
            const emailData = {
                to: [this.receiverEmail],
                subject: `🔔 ${matchingJobs.length} New Airbnb Job${matchingJobs.length > 1 ? 's' : ''} - ${matchingJobs.map(j => j.title).join(', ').substring(0, 50)}${matchingJobs.map(j => j.title).join(', ').length > 50 ? '...' : ''}`,
                body: emailHTML,
                isHTML: true
            };

            console.log(`📧 Sending email notification for ${matchingJobs.length} matching job(s)...`);
            
            // Send email via MailSlurp API
            const response = await fetch(`${this.baseUrl}/inboxes/${this.inbox.id}/emails`, {
                method: 'POST',
                headers: {
                    'x-api-key': this.apiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(emailData)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to send email: ${response.statusText} - ${errorText}`);
            }
            
            const result = await response.json();
            
            console.log(`✅ Email sent successfully! Email ID: ${result.id}`);
            console.log(`📧 Sent to: ${this.receiverEmail}`);
            console.log(`📝 Subject: ${emailData.subject}`);
            
            return { 
                success: true, 
                emailId: result.id, 
                matchingJobsCount: matchingJobs.length,
                subject: emailData.subject
            };

        } catch (error) {
            console.error('❌ Failed to send email:', error);
            return { success: false, error: error.message };
        }
    }

    async testEmailService() {
        try {
            if (!this.inbox || !this.inbox.id) {
                await this.initialize();
                
                if (!this.inbox || !this.inbox.id) {
                    throw new Error('Failed to initialize inbox for testing');
                }
            }
            
            const testHTML = `
            <html>
            <body style="font-family: Arial, sans-serif;">
                <h2 style="color: #FF5A5F;">🧪 Cloudflare Workers Email Test</h2>
                <p>This is a test email from your Airbnb Job Scraper running on Cloudflare Workers.</p>
                <p><strong>Inbox:</strong> ${this.inbox.emailAddress}</p>
                <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
                <p style="color: #666; font-size: 12px;">If you received this, your Workers email service is working correctly!</p>
            </body>
            </html>
            `;

            const response = await fetch(`${this.baseUrl}/inboxes/${this.inbox.id}/emails`, {
                method: 'POST',
                headers: {
                    'x-api-key': this.apiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    to: [this.receiverEmail],
                    subject: '🧪 Cloudflare Workers - Test Email',
                    body: testHTML,
                    isHTML: true
                })
            });

            if (!response.ok) {
                throw new Error(`Test email failed: ${response.statusText}`);
            }

            const result = await response.json();
            console.log('✅ Test email sent successfully!');
            return { success: true, emailId: result.id };

        } catch (error) {
            console.error('❌ Test email failed:', error);
            return { success: false, error: error.message };
        }
    }
}
