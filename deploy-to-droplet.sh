#!/bin/bash

# LinearBot Deployment Script for DigitalOcean Droplet
# This script sets up and deploys the LinearBot on your droplet

set -e  # Exit on error

echo "🚀 Starting LinearBot deployment..."

# Update system packages
echo "📦 Updating system packages..."
apt-get update
apt-get upgrade -y

# Install Node.js 18.x
echo "📦 Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Install PM2 globally
echo "📦 Installing PM2..."
npm install -g pm2

# Install Git if not already installed
echo "📦 Installing Git..."
apt-get install -y git

# Create app directory
echo "📁 Creating application directory..."
mkdir -p /var/www/linearbot
cd /var/www/linearbot

# Clone the repository
echo "📥 Cloning repository..."
if [ -d ".git" ]; then
    echo "Repository already exists, pulling latest changes..."
    git pull origin main
else
    git clone https://github.com/Raxylol/LinearBot.git .
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the application
echo "🔨 Building application..."
npm run build

# Create data and logs directories
echo "📁 Creating data and logs directories..."
mkdir -p data logs

# Set up PM2
echo "⚙️ Setting up PM2..."
pm2 delete linearbot || true  # Delete if exists
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Set up PM2 to start on boot
pm2 startup systemd -u root --hp /root
pm2 save

# Set up log rotation
echo "📝 Setting up log rotation..."
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:compress true
pm2 set pm2-logrotate:rotateInterval '0 0 * * *'

echo "✅ Deployment complete!"
echo ""
echo "📊 Check status with: pm2 status"
echo "📝 View logs with: pm2 logs linearbot"
echo "🔄 Restart with: pm2 restart linearbot"
echo ""
echo "🤖 Your LinearBot should now be running!"