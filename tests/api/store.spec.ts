import { test, expect } from '../../src/fixtures/index.js';

/**
 * Auto-generated API tests for: store
 * Source: https://petstore3.swagger.io/api/v3/openapi.json
 * Generated at: 2026-03-22T12:43:04.857Z
 *
 * You can freely edit this file to add custom assertions and scenarios.
 */

test.describe('store', () => {

  test('GET /store/inventory → should respond successfully', { tag: ['@api', '@store'] }, async ({ apiClient }) => {
    const response = await apiClient.get("/store/inventory");

    expect(response.status()).toBeLessThan(500);
    // Validate response schema (only if JSON response)
    const contentType = response.headers()['content-type'] ?? '';
    if (contentType.includes('application/json')) {
      const body = await response.json();
      expect(body).toBeDefined();
    }
  });

  test('POST /store/order → should respond successfully', { tag: ['@api', '@store'] }, async ({ apiClient }) => {
    const response = await apiClient.post("/store/order", {
      data: {},
    });

    expect(response.status()).toBeLessThan(500);
    // Validate response schema (only if JSON response)
    const contentType = response.headers()['content-type'] ?? '';
    if (contentType.includes('application/json')) {
      const body = await response.json();
      expect(body).toBeDefined();
    }
  });

  test('GET /store/order/{orderId} → should respond successfully', { tag: ['@api', '@store'] }, async ({ apiClient }) => {
    const response = await apiClient.get("/store/order/1");

    expect(response.status()).toBeLessThan(500);
    // Validate response schema (only if JSON response)
    const contentType = response.headers()['content-type'] ?? '';
    if (contentType.includes('application/json')) {
      const body = await response.json();
      expect(body).toBeDefined();
    }
  });

  test('DELETE /store/order/{orderId} → should respond successfully', { tag: ['@api', '@store'] }, async ({ apiClient }) => {
    const response = await apiClient.delete("/store/order/1");

    expect(response.status()).toBeLessThan(500);
  });
});
