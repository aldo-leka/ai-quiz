/**
 * Script to generate .env file for the client application
 * This script is used during the build process in Coolify
 */

const fs = require('fs');
const path = require('path');

// Define the environment variables needed for the client
const envVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_API_URL',
  'NEXT_PUBLIC_STRIPE_PUBLIC_KEY'
];

// Create the .env content by reading from process.env
const envFileContent = envVars
  .map(key => {
    const value = process.env[key] || '';
    console.log(`Reading env var ${key}: ${value ? 'Value found' : 'Empty'}`);
    return `${key}=${value}`;
  })
  .join('\n');

// Determine the output path (.env in the client directory)
const outputPath = path.resolve(__dirname, '..', '.env');

// Write the .env file
try {
  fs.writeFileSync(outputPath, envFileContent);
  console.log('✅ Client .env file created successfully!');
  console.log('📄 Client .env file contents:');
  console.log(envFileContent);
} catch (error) {
  console.error('❌ Error creating client .env file:', error);
  process.exit(1);
}