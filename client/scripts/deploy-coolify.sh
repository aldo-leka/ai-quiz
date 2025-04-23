#!/bin/bash
set -e

echo "Using directly accessed repository files..."

# Set paths
REPO_ROOT=$(cd /app && cd .. && pwd)
SHARED_DIR="$REPO_ROOT/shared"
QUIZ_GEN_DIR="$REPO_ROOT/quiz-generator"

# Check if we can access the parent directory
if [ ! -d "$SHARED_DIR" ]; then
  echo "Error: Cannot access shared directory at $SHARED_DIR"
  echo "Current path structure:"
  ls -la $REPO_ROOT
  exit 1
fi

# Build shared
echo "Building shared package..."
cd "$SHARED_DIR"
npm install
npm run build

# Build quiz-generator
echo "Building quiz-generator package..."
cd "$QUIZ_GEN_DIR"
npm install
npm run build

# Build client
echo "Building client application..."
cd /app
npm install
npm install "$SHARED_DIR"
npm install "$QUIZ_GEN_DIR"
npm run build

echo "Client build completed successfully!"