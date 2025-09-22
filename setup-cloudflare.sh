#!/bin/bash

echo "🚀 Setting up Cloudflare Workers for Airbnb Job Scraper"
echo "======================================================="

# Check if wrangler is available
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found. Installing..."
    npm install -g wrangler
fi

echo "1. 🔐 Authenticating with Cloudflare..."
npx wrangler login

echo ""
echo "2. 📦 Creating KV namespaces..."
echo "Creating production namespace..."
npx wrangler kv:namespace create JOB_STORAGE

echo "Creating preview namespace..."
npx wrangler kv:namespace create JOB_STORAGE --preview

echo ""
echo "⚠️  IMPORTANT: Update wrangler.toml with the namespace IDs shown above!"
echo ""

echo "3. 🔑 Setting up environment variables..."
echo "Setting MailSlurp API key..."
npx wrangler secret put MAILSLURP_API_KEY

echo "Setting email receiver..."
npx wrangler secret put EMAIL_RECEIVER

echo "Setting job keywords (optional - press enter to use defaults)..."
read -p "Enter keywords (comma-separated) or press enter for defaults: " keywords
if [ ! -z "$keywords" ]; then
    echo "$keywords" | npx wrangler secret put JOB_KEYWORDS
fi

echo "Setting Airbnb URL (optional - press enter to use default)..."
read -p "Enter custom URL or press enter for default: " url
if [ ! -z "$url" ]; then
    echo "$url" | npx wrangler secret put AIRBNB_JOBS_URL
fi

echo ""
echo "4. 🧪 Testing locally..."
echo "Starting local development server..."
echo "Visit http://localhost:8787 to test your worker"
echo "Press Ctrl+C to stop and continue with deployment"
npm run dev:worker

echo ""
echo "5. 🚀 Ready to deploy!"
echo "Run 'npm run deploy' to deploy to production"
echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update wrangler.toml with the KV namespace IDs"
echo "2. Run 'npm run deploy' to deploy"
echo "3. Visit your worker URL to test"
