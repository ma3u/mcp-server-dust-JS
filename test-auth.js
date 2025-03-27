// Simple authentication test for Dust API
const axios = require('axios');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// API key and base URL
const apiKey = process.env.DUST_API_KEY;
const baseUrl = process.env.DUST_DOMAIN || 'https://dust.tt';

console.log('Testing Dust API authentication');
console.log('- Base URL:', baseUrl);
console.log('- API Key (masked):', apiKey ? '****' + apiKey.slice(-4) : 'not set');

// Test the /me endpoint with different authentication methods
async function testAuth() {
  console.log('\n1. Testing with Authorization: Bearer {apiKey} header');
  try {
    const response1 = await axios.get(`${baseUrl}/api/v1/me`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });
    console.log('✅ SUCCESS! Authentication method 1 works.');
    console.log('Response:', JSON.stringify(response1.data, null, 2));
    return;
  } catch (error) {
    console.log('❌ FAILED with method 1:', error.message);
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
  
  console.log('\n2. Testing with Authorization: {apiKey} header');
  try {
    const response2 = await axios.get(`${baseUrl}/api/v1/me`, {
      headers: {
        'Authorization': apiKey
      }
    });
    console.log('✅ SUCCESS! Authentication method 2 works.');
    console.log('Response:', JSON.stringify(response2.data, null, 2));
    return;
  } catch (error) {
    console.log('❌ FAILED with method 2:', error.message);
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
  
  console.log('\n3. Testing with Authorization: Basic {apiKey} header');
  try {
    const response3 = await axios.get(`${baseUrl}/api/v1/me`, {
      headers: {
        'Authorization': `Basic ${apiKey}`
      }
    });
    console.log('✅ SUCCESS! Authentication method 3 works.');
    console.log('Response:', JSON.stringify(response3.data, null, 2));
    return;
  } catch (error) {
    console.log('❌ FAILED with method 3:', error.message);
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
  
  console.log('\n4. Testing with x-api-key header');
  try {
    const response4 = await axios.get(`${baseUrl}/api/v1/me`, {
      headers: {
        'x-api-key': apiKey
      }
    });
    console.log('✅ SUCCESS! Authentication method 4 works.');
    console.log('Response:', JSON.stringify(response4.data, null, 2));
    return;
  } catch (error) {
    console.log('❌ FAILED with method 4:', error.message);
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
  
  console.log('\n5. Testing with apiKey as query parameter');
  try {
    const response5 = await axios.get(`${baseUrl}/api/v1/me?apiKey=${apiKey}`);
    console.log('✅ SUCCESS! Authentication method 5 works.');
    console.log('Response:', JSON.stringify(response5.data, null, 2));
    return;
  } catch (error) {
    console.log('❌ FAILED with method 5:', error.message);
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
  
  console.log('\nALL AUTHENTICATION METHODS FAILED');
  console.log('Please check that your API key is valid and has the correct permissions.');
}

testAuth();
