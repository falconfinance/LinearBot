#!/bin/bash

# Remote deployment script
# This script connects to your droplet and runs the deployment

DROPLET_IP="64.227.171.183"
DROPLET_USER="root"
DROPLET_PASS="h90ac5K10M"

echo "🚀 Deploying LinearBot to DigitalOcean Droplet..."
echo "📡 Connecting to $DROPLET_IP..."

# Copy the deployment script to the droplet
echo "📤 Copying deployment script..."
scp deploy-to-droplet.sh $DROPLET_USER@$DROPLET_IP:/tmp/

# Execute the deployment script on the droplet
echo "🔧 Running deployment..."
ssh $DROPLET_USER@$DROPLET_IP "bash /tmp/deploy-to-droplet.sh"

echo "✅ Deployment initiated!"