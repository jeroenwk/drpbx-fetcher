import { PKCEGenerator } from '../src/utils/crypto';

describe('PKCEGenerator', () => {
  describe('generateCodeVerifier', () => {
    it('should generate a code verifier', async () => {
      const verifier = await PKCEGenerator.generateCodeVerifier();
      expect(verifier).toBeDefined();
      expect(typeof verifier).toBe('string');
      expect(verifier.length).toBeGreaterThan(0);
    });

    it('should generate URL-safe base64 string', async () => {
      const verifier = await PKCEGenerator.generateCodeVerifier();
      // URL-safe base64 should not contain +, /, or =
      expect(verifier).not.toMatch(/[+/=]/);
    });

    it('should generate different verifiers each time', async () => {
      const verifier1 = await PKCEGenerator.generateCodeVerifier();
      const verifier2 = await PKCEGenerator.generateCodeVerifier();
      expect(verifier1).not.toBe(verifier2);
    });

    it('should generate verifier of appropriate length', async () => {
      // 32 bytes encoded as base64url should be ~43 characters
      const verifier = await PKCEGenerator.generateCodeVerifier();
      expect(verifier.length).toBeGreaterThanOrEqual(40);
      expect(verifier.length).toBeLessThanOrEqual(45);
    });
  });

  describe('generateCodeChallenge', () => {
    it('should generate a code challenge from verifier', async () => {
      const verifier = await PKCEGenerator.generateCodeVerifier();
      const challenge = await PKCEGenerator.generateCodeChallenge(verifier);

      expect(challenge).toBeDefined();
      expect(typeof challenge).toBe('string');
      expect(challenge.length).toBeGreaterThan(0);
    });

    it('should generate URL-safe base64 string', async () => {
      const verifier = await PKCEGenerator.generateCodeVerifier();
      const challenge = await PKCEGenerator.generateCodeChallenge(verifier);

      // URL-safe base64 should not contain +, /, or =
      expect(challenge).not.toMatch(/[+/=]/);
    });

    it('should generate same challenge for same verifier', async () => {
      const verifier = 'test-verifier-123';
      const challenge1 = await PKCEGenerator.generateCodeChallenge(verifier);
      const challenge2 = await PKCEGenerator.generateCodeChallenge(verifier);

      expect(challenge1).toBe(challenge2);
    });

    it('should generate different challenges for different verifiers', async () => {
      const verifier1 = await PKCEGenerator.generateCodeVerifier();
      const verifier2 = await PKCEGenerator.generateCodeVerifier();

      const challenge1 = await PKCEGenerator.generateCodeChallenge(verifier1);
      const challenge2 = await PKCEGenerator.generateCodeChallenge(verifier2);

      expect(challenge1).not.toBe(challenge2);
    });

    it('should generate challenge of appropriate length', async () => {
      const verifier = await PKCEGenerator.generateCodeVerifier();
      const challenge = await PKCEGenerator.generateCodeChallenge(verifier);

      // SHA-256 hash (32 bytes) encoded as base64url should be ~43 characters
      expect(challenge.length).toBeGreaterThanOrEqual(40);
      expect(challenge.length).toBeLessThanOrEqual(45);
    });
  });

  describe('PKCE flow', () => {
    it('should support complete PKCE flow', async () => {
      // Generate verifier and challenge
      const verifier = await PKCEGenerator.generateCodeVerifier();
      const challenge = await PKCEGenerator.generateCodeChallenge(verifier);

      // Both should be valid strings
      expect(verifier).toBeTruthy();
      expect(challenge).toBeTruthy();

      // They should be different
      expect(verifier).not.toBe(challenge);

      // Both should be URL-safe
      expect(verifier).not.toMatch(/[+/=]/);
      expect(challenge).not.toMatch(/[+/=]/);
    });
  });
});
