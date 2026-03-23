import { describe, it, expect } from "vitest";
import { createHttpClient } from "@/lib/http/client";
import { isSSRFSafe } from "@/lib/api/ssrf";

describe("HTTP Client Security", () => {
  describe("Response Size Limits", () => {
    it("should have maxContentLength configured to prevent memory exhaustion", () => {
      const client = createHttpClient();
      const instance = client.getAxiosInstance();

      // Check that maxContentLength is set to 10MB
      expect(instance.defaults.maxContentLength).toBe(10 * 1024 * 1024);
    });

    it("should have maxBodyLength configured to prevent memory exhaustion", () => {
      const client = createHttpClient();
      const instance = client.getAxiosInstance();

      // Check that maxBodyLength is set to 10MB
      expect(instance.defaults.maxBodyLength).toBe(10 * 1024 * 1024);
    });
  });

  describe("Redirect Handling Configuration", () => {
    it("should disable automatic redirects (handled manually with SSRF checks)", () => {
      const client = createHttpClient();
      const instance = client.getAxiosInstance();

      // Check that automatic redirects are disabled
      // We handle redirects manually in the response interceptor with SSRF validation
      expect(instance.defaults.maxRedirects).toBe(0);
    });

    it("should have SSRF protection that blocks localhost redirects", () => {
      // Verify SSRF protection would block common redirect attack targets
      expect(isSSRFSafe("http://localhost:8080")).toBe(false);
      expect(isSSRFSafe("http://127.0.0.1")).toBe(false);
    });

    it("should have SSRF protection that blocks private IP redirects", () => {
      expect(isSSRFSafe("http://192.168.1.1")).toBe(false);
      expect(isSSRFSafe("http://10.0.0.1")).toBe(false);
      expect(isSSRFSafe("http://172.16.0.1")).toBe(false);
    });

    it("should have SSRF protection that blocks cloud metadata redirects", () => {
      expect(isSSRFSafe("http://169.254.169.254/latest/meta-data/")).toBe(
        false
      );
      expect(isSSRFSafe("http://metadata.google.internal")).toBe(false);
    });

    it("should allow public URLs", () => {
      expect(isSSRFSafe("https://example.com")).toBe(true);
      expect(isSSRFSafe("https://google.com")).toBe(true);
    });
  });

  describe("Security Configuration Summary", () => {
    it("should have all critical security protections enabled", () => {
      const client = createHttpClient();
      const instance = client.getAxiosInstance();

      // Verify all security measures are in place
      const securityChecks = {
        hasResponseSizeLimit: instance.defaults.maxContentLength === 10485760,
        hasBodySizeLimit: instance.defaults.maxBodyLength === 10485760,
        hasManualRedirectHandling: instance.defaults.maxRedirects === 0,
        hasUserAgent: instance.defaults.headers?.["User-Agent"] !== undefined,
        hasCompression:
          instance.defaults.headers?.["Accept-Encoding"] !== undefined,
      };

      expect(securityChecks).toEqual({
        hasResponseSizeLimit: true,
        hasBodySizeLimit: true,
        hasManualRedirectHandling: true,
        hasUserAgent: true,
        hasCompression: true,
      });
    });
  });
});
