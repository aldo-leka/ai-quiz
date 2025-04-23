#!/bin/bash
set -e

# Clone repo to get access to shared modules
echo "Cloning repository to access shared modules..."
git clone --depth 1 https://github.com/yourusername/ai-quiz.git /tmp/repo

# Build shared
echo "Building shared package..."
cd /tmp/repo/shared
npm install
npm run build

# Build quiz-generator
echo "Building quiz-generator package..."
cd /tmp/repo/quiz-generator
npm install
npm run build

# Build client
echo "Building client application..."
cd /app
npm install
npm install /tmp/repo/shared
npm install /tmp/repo/quiz-generator
npm run build

echo "Client build completed successfully!"