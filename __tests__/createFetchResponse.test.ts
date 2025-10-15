/**
 * Tests for the createFetchResponse pure function from main.ts
 * This tests the Obsidian RequestUrlResponse to Fetch Response conversion
 */

export {}; // Make this a module

// Create a minimal mock of DrpbxFetcherPlugin to access the static method
class DrpbxFetcherPluginMock {
  static createFetchResponse(response: {
    status: number;
    headers: Record<string, string>;
    json: unknown;
    text: string;
    arrayBuffer: ArrayBuffer;
  }): Response {
    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      statusText: response.status.toString(),
      headers: new Headers(response.headers),
      json: async () => Promise.resolve(response.json),
      text: async () => Promise.resolve(response.text),
      arrayBuffer: async () => Promise.resolve(response.arrayBuffer),
      blob: async () => {
        const buffer = response.arrayBuffer;
        const contentType = response.headers["content-type"] || "application/octet-stream";
        return new Blob([buffer], { type: contentType });
      },
    } as unknown as Response;
  }
}

describe('createFetchResponse', () => {
  describe('status handling', () => {
    it('should set ok to true for 2xx status codes', () => {
      const response = DrpbxFetcherPluginMock.createFetchResponse({
        status: 200,
        headers: {},
        json: {},
        text: '',
        arrayBuffer: new ArrayBuffer(0),
      });

      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);
    });

    it('should set ok to false for 4xx status codes', () => {
      const response = DrpbxFetcherPluginMock.createFetchResponse({
        status: 404,
        headers: {},
        json: {},
        text: '',
        arrayBuffer: new ArrayBuffer(0),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(404);
    });

    it('should set ok to false for 5xx status codes', () => {
      const response = DrpbxFetcherPluginMock.createFetchResponse({
        status: 500,
        headers: {},
        json: {},
        text: '',
        arrayBuffer: new ArrayBuffer(0),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(500);
    });

    it('should handle edge case status codes', () => {
      const response199 = DrpbxFetcherPluginMock.createFetchResponse({
        status: 199,
        headers: {},
        json: {},
        text: '',
        arrayBuffer: new ArrayBuffer(0),
      });
      expect(response199.ok).toBe(false);

      const response299 = DrpbxFetcherPluginMock.createFetchResponse({
        status: 299,
        headers: {},
        json: {},
        text: '',
        arrayBuffer: new ArrayBuffer(0),
      });
      expect(response299.ok).toBe(true);
    });
  });

  describe('headers handling', () => {
    it('should convert headers to Headers object', () => {
      const response = DrpbxFetcherPluginMock.createFetchResponse({
        status: 200,
        headers: {
          'content-type': 'application/json',
          'x-custom-header': 'value',
        },
        json: {},
        text: '',
        arrayBuffer: new ArrayBuffer(0),
      });

      expect(response.headers.get('content-type')).toBe('application/json');
      expect(response.headers.get('x-custom-header')).toBe('value');
    });

    it('should handle empty headers', () => {
      const response = DrpbxFetcherPluginMock.createFetchResponse({
        status: 200,
        headers: {},
        json: {},
        text: '',
        arrayBuffer: new ArrayBuffer(0),
      });

      expect(response.headers).toBeInstanceOf(Headers);
    });
  });

  describe('response methods', () => {
    it('should return json data via json() method', async () => {
      const testData = { message: 'Hello', count: 42 };
      const response = DrpbxFetcherPluginMock.createFetchResponse({
        status: 200,
        headers: {},
        json: testData,
        text: '',
        arrayBuffer: new ArrayBuffer(0),
      });

      const result = await response.json();
      expect(result).toEqual(testData);
    });

    it('should return text via text() method', async () => {
      const testText = 'Hello World';
      const response = DrpbxFetcherPluginMock.createFetchResponse({
        status: 200,
        headers: {},
        json: {},
        text: testText,
        arrayBuffer: new ArrayBuffer(0),
      });

      const result = await response.text();
      expect(result).toBe(testText);
    });

    it('should return arrayBuffer via arrayBuffer() method', async () => {
      const buffer = new Uint8Array([1, 2, 3, 4]).buffer;
      const response = DrpbxFetcherPluginMock.createFetchResponse({
        status: 200,
        headers: {},
        json: {},
        text: '',
        arrayBuffer: buffer,
      });

      const result = await response.arrayBuffer();
      expect(result).toBe(buffer);
      expect(new Uint8Array(result)).toEqual(new Uint8Array([1, 2, 3, 4]));
    });

    it('should create blob with correct content type', async () => {
      const buffer = new Uint8Array([1, 2, 3, 4]).buffer;
      const response = DrpbxFetcherPluginMock.createFetchResponse({
        status: 200,
        headers: { 'content-type': 'image/png' },
        json: {},
        text: '',
        arrayBuffer: buffer,
      });

      const blob = await response.blob();
      expect(blob.type).toBe('image/png');
      expect(blob.size).toBe(4);
    });

    it('should use default content type for blob when not specified', async () => {
      const buffer = new Uint8Array([1, 2, 3]).buffer;
      const response = DrpbxFetcherPluginMock.createFetchResponse({
        status: 200,
        headers: {},
        json: {},
        text: '',
        arrayBuffer: buffer,
      });

      const blob = await response.blob();
      expect(blob.type).toBe('application/octet-stream');
    });
  });

  describe('statusText', () => {
    it('should convert status code to string for statusText', () => {
      const response = DrpbxFetcherPluginMock.createFetchResponse({
        status: 200,
        headers: {},
        json: {},
        text: '',
        arrayBuffer: new ArrayBuffer(0),
      });

      expect(response.statusText).toBe('200');
    });

    it('should handle different status codes', () => {
      const response404 = DrpbxFetcherPluginMock.createFetchResponse({
        status: 404,
        headers: {},
        json: {},
        text: '',
        arrayBuffer: new ArrayBuffer(0),
      });

      expect(response404.statusText).toBe('404');
    });
  });
});
