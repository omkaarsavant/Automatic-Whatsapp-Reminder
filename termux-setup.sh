#!/bin/bash

# WhatsApp Reminder System - Termux Setup Script
# This script automates the installation of dependencies on Android via Termux.

echo "--- Starting Termux Setup ---"

# 1. Update and Upgrade
echo "Updating packages..."
pkg update -y && pkg upgrade -y

# 2. Install Essentials
echo "Installing Node.js, SQLite, Python, and Build Tools..."
pkg install -y nodejs-lts sqlite git python binutils build-essential make clang termux-tools

# 3. Create Data Directory if it doesn't exist
echo "Creating data directories..."
mkdir -p data/excel 
mkdir -p data/backup

# 4. Global Fixes for Node-Gyp (Python 3.12+ and NDK issues)
echo "Applying Python and NDK compatibility fixes..."
pip install setuptools
mkdir -p ~/.gyp
echo "{ 'variables': { 'android_ndk_path': '' } }" > ~/.gyp/include.gypi
export SETUPTOOLS_USE_DISTUTILS=local

# 4. Install PM2 for 24/7 background running
echo "Installing PM2..."
npm install -g pm2

# 5. Install Project Dependencies
echo "Installing project dependencies..."
rm -rf node_modules package-lock.json
npm install

echo "--- Setup Complete! ---"
echo ""
echo "TO START THE SYSTEM:"
echo "1. Reset your session: rm database.sqlite (Recommended to fix Bad MAC errors)"
echo "2. Run: npm start"
echo "3. Scan the QR code with your phone's WhatsApp."
echo ""
echo "TO RUN 24/7 IN BACKGROUND:"
echo "1. Run: pm2 start src/index.js --name reminder-bot"
echo "2. Run: pm2 save"
echo ""
echo "DASHBOARD ACCESS:"
echo "Open Chrome on your phone and go to: http://localhost:3000"
