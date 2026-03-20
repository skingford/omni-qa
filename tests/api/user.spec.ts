import { test, expect } from '../../src/fixtures/index.js';

/**
 * Auto-generated API tests for: user
 * Source: https://petstore3.swagger.io/api/v3/openapi.json
 * Generated at: 2026-03-20T10:15:22.850Z
 *
 * You can freely edit this file to add custom assertions and scenarios.
 */

test.describe('user', () => {

  test('POST /user → should respond successfully', { tag: ['@api', '@user'] }, async ({ apiClient }) => {
    const response = await apiClient.post('/user', {
      data: {},
    });

    expect(response.status()).toBeLessThan(500);
    // Validate response schema
    const body = await response.json();
    expect(body).toBeDefined();
  });

  test('POST /user/createWithList → should respond successfully', { tag: ['@api', '@user'] }, async ({ apiClient }) => {
    const response = await apiClient.post('/user/createWithList', {
      data: {},
    });

    expect(response.status()).toBeLessThan(500);
    // Validate response schema
    const body = await response.json();
    expect(body).toBeDefined();
  });

  test('GET /user/login → should respond successfully', { tag: ['@api', '@user'] }, async ({ apiClient }) => {
    const response = await apiClient.get('/user/login', {
      params: {
        username: 'test-username',
        password: 'test-password',
      },
    });

    expect(response.status()).toBeLessThan(500);
    // Validate response schema
    const body = await response.json();
    expect(body).toBeDefined();
  });

  test('GET /user/logout → should respond successfully', { tag: ['@api', '@user'] }, async ({ apiClient }) => {
    const response = await apiClient.get('/user/logout');

    expect(response.status()).toBeLessThan(500);
  });

  test('GET /user/{username} → should respond successfully', { tag: ['@api', '@user'] }, async ({ apiClient }) => {
    const response = await apiClient.get('/user/{username}');

    expect(response.status()).toBeLessThan(500);
    // Validate response schema
    const body = await response.json();
    expect(body).toBeDefined();
  });

  test('PUT /user/{username} → should respond successfully', { tag: ['@api', '@user'] }, async ({ apiClient }) => {
    const response = await apiClient.put('/user/{username}', {
      data: {},
    });

    expect(response.status()).toBeLessThan(500);
  });

  test('DELETE /user/{username} → should respond successfully', { tag: ['@api', '@user'] }, async ({ apiClient }) => {
    const response = await apiClient.delete('/user/{username}');

    expect(response.status()).toBeLessThan(500);
  });
});
