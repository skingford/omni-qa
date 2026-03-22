import { test, expect } from '../../src/fixtures/index.js';

/**
 * Auto-generated API tests for: pet
 * Source: https://petstore3.swagger.io/api/v3/openapi.json
 * Generated at: 2026-03-22T12:43:04.813Z
 *
 * You can freely edit this file to add custom assertions and scenarios.
 */

test.describe('pet', () => {

  test('POST /pet → should respond successfully', { tag: ['@api', '@pet'] }, async ({ apiClient }) => {
    const response = await apiClient.post("/pet", {
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

  test('PUT /pet → should respond successfully', { tag: ['@api', '@pet'] }, async ({ apiClient }) => {
    const response = await apiClient.put("/pet", {
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

  test('GET /pet/findByStatus → should respond successfully', { tag: ['@api', '@pet'] }, async ({ apiClient }) => {
    const response = await apiClient.get("/pet/findByStatus", {
      params: {
        status: "test-status",
      },
    });

    expect(response.status()).toBeLessThan(500);
    // Validate response schema (only if JSON response)
    const contentType = response.headers()['content-type'] ?? '';
    if (contentType.includes('application/json')) {
      const body = await response.json();
      expect(body).toBeDefined();
    }
  });

  test('GET /pet/findByTags → should respond successfully', { tag: ['@api', '@pet'] }, async ({ apiClient }) => {
    const response = await apiClient.get("/pet/findByTags", {
      params: {
        tags: [
  "test-tags"
],
      },
    });

    expect(response.status()).toBeLessThan(500);
    // Validate response schema (only if JSON response)
    const contentType = response.headers()['content-type'] ?? '';
    if (contentType.includes('application/json')) {
      const body = await response.json();
      expect(body).toBeDefined();
    }
  });

  test('GET /pet/{petId} → should respond successfully', { tag: ['@api', '@pet'] }, async ({ apiClient }) => {
    const response = await apiClient.get("/pet/1");

    expect(response.status()).toBeLessThan(500);
    // Validate response schema (only if JSON response)
    const contentType = response.headers()['content-type'] ?? '';
    if (contentType.includes('application/json')) {
      const body = await response.json();
      expect(body).toBeDefined();
    }
  });

  test('POST /pet/{petId} → should respond successfully', { tag: ['@api', '@pet'] }, async ({ apiClient }) => {
    const response = await apiClient.post("/pet/1", {
      params: {
        name: "test-name",
        status: "test-status",
      },
    });

    expect(response.status()).toBeLessThan(500);
    // Validate response schema (only if JSON response)
    const contentType = response.headers()['content-type'] ?? '';
    if (contentType.includes('application/json')) {
      const body = await response.json();
      expect(body).toBeDefined();
    }
  });

  test('DELETE /pet/{petId} → should respond successfully', { tag: ['@api', '@pet'] }, async ({ apiClient }) => {
    const response = await apiClient.delete("/pet/1");

    expect(response.status()).toBeLessThan(500);
  });

  test('POST /pet/{petId}/uploadImage → should respond successfully', { tag: ['@api', '@pet'] }, async ({ apiClient }) => {
    const response = await apiClient.post("/pet/1/uploadImage", {
      params: {
        additionalMetadata: "test-additionalMetadata",
      },
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
});
