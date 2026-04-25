#!/usr/bin/env node

/**
 * Test script to verify clan endpoints are working in production
 * Usage: node test-clan-endpoints.js <token> <clan_id>
 */

const https = require('https');

const BASE_URL = 'https://wahu-backend.onrender.com';
const ENDPOINTS = [
  { method: 'GET', path: '/api/clans', name: 'Get all clans' },
  { method: 'GET', path: '/api/clans/44444444-0000-0000-0000-000000001/members', name: 'Get clan members' },
  { method: 'GET', path: '/api/clans/44444444-0000-0000-0000-000000001/gallery', name: 'Get clan gallery' },
  { method: 'GET', path: '/api/clans/44444444-0000-0000-0000-000000001/messages', name: 'Get clan messages' },
  { method: 'GET', path: '/api/clans/44444444-0000-0000-0000-000000001/posts', name: 'Get clan posts' },
];

async function testEndpoint(method, path, token) {
  return new Promise((resolve) => {
    const url = new URL(BASE_URL + path);
    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    };

    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          statusText: res.statusMessage,
          path,
          method,
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        error: err.message,
        path,
        method,
      });
    });

    req.end();
  });
}

async function runTests() {
  const token = process.argv[2];
  if (!token) {
    console.log('Usage: node test-clan-endpoints.js <auth_token>');
    console.log('\nExample with demo user token:');
    console.log('  node test-clan-endpoints.js eyJhbGciOiJIUzI1NiIs...');
    process.exit(1);
  }

  console.log('Testing Render backend endpoints...\n');
  console.log(`Base URL: ${BASE_URL}\n`);

  for (const endpoint of ENDPOINTS) {
    console.log(`Testing: ${endpoint.method} ${endpoint.path}`);
    const result = await testEndpoint(endpoint.method, endpoint.path, token);

    if (result.error) {
      console.log(`  ❌ Error: ${result.error}`);
    } else {
      const status = result.status === 200 ? '✅' : '❌';
      console.log(`  ${status} Status: ${result.status} ${result.statusText}`);
    }
    console.log('');
  }
}

runTests().catch(console.error);
