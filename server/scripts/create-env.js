/**
 * Script to generate .env file for the server application
 * This script is used during the build process in Coolify
 */

const fs = require('fs');
const path = require('path');

// Define the environment variables needed for the server
const envVars = [
  'PORT',
  'CORS_ORIGIN',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'RESEND_API_KEY'
];

// Create the .env content by reading from process.env
const envFileContent = envVars
  .map(key => {
    const value = process.env[key] || '';
    return `${key}=${value}`;
  })
  .join('\n');

// Determine the output path (.env in the server directory)
const outputPath = path.resolve(__dirname, '..', '.env');

// Write the .env file
try {
  fs.writeFileSync(outputPath, envFileContent);
  console.log('✅ Server .env file created successfully!');
} catch (error) {
  console.error('❌ Error creating server .env file:', error);
  process.exit(1);
}