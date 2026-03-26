import { describe, it, expect } from "vitest";
import { isSSRFSafe, getSSRFBlockReason } from "@/lib/api";

describe("SSRF Protection", () => {
  describe("isSSRFSafe", () => {
    it("should allow valid public URLs", () => {
      expect(isSSRFSafe("https://example.com")).toBe(true);
      expect(isSSRFSafe("http://example.com")).toBe(true);
      expect(isSSRFSafe("https://subdomain.example.com")).toBe(true);
    });

    it("should block localhost", () => {
      expect(isSSRFSafe("http://localhost")).toBe(false);
      expect(isSSRFSafe("http://localhost:8080")).toBe(false);
      expect(isSSRFSafe("https://localhost")).toBe(false);
    });

    it("should block 127.0.0.1", () => {
      expect(isSSRFSafe("http://127.0.0.1")).toBe(false);
      expect(isSSRFSafe("http://127.0.0.1:3000")).toBe(false);
    });

    it("should block 0.0.0.0", () => {
      expect(isSSRFSafe("http://0.0.0.0")).toBe(false);
    });

    it("should block IPv6 localhost", () => {
      expect(isSSRFSafe("http://[::1]")).toBe(false);
    });

    it("should block AWS metadata endpoint", () => {
      expect(isSSRFSafe("http://169.254.169.254")).toBe(false);
      expect(isSSRFSafe("http://169.254.169.254/latest/meta-data")).toBe(false);
    });

    it("should block GCP metadata endpoint", () => {
      expect(isSSRFSafe("http://metadata.google.internal")).toBe(false);
    });

    it("should block private network 10.x.x.x", () => {
      expect(isSSRFSafe("http://10.0.0.1")).toBe(false);
      expect(isSSRFSafe("http://10.1.2.3")).toBe(false);
    });

    it("should block private network 172.16-31.x.x", () => {
      expect(isSSRFSafe("http://172.16.0.1")).toBe(false);
      expect(isSSRFSafe("http://172.20.0.1")).toBe(false);
      expect(isSSRFSafe("http://172.31.255.255")).toBe(false);
    });

    it("should block private network 192.168.x.x", () => {
      expect(isSSRFSafe("http://192.168.1.1")).toBe(false);
      expect(isSSRFSafe("http://192.168.0.1")).toBe(false);
    });

    it("should block .local domains", () => {
      expect(isSSRFSafe("http://myserver.local")).toBe(false);
      expect(isSSRFSafe("http://printer.local")).toBe(false);
    });

    it("should block non-HTTP(S) protocols", () => {
      expect(isSSRFSafe("ftp://example.com")).toBe(false);
      expect(isSSRFSafe("file:///etc/passwd")).toBe(false);
      expect(isSSRFSafe("gopher://example.com")).toBe(false);
    });

    it("should reject invalid URLs", () => {
      expect(isSSRFSafe("not-a-url")).toBe(false);
      expect(isSSRFSafe("")).toBe(false);
    });
  });

  describe("getSSRFBlockReason", () => {
    it("should return reason for blocked localhost", () => {
      const reason = getSSRFBlockReason("http://localhost");
      expect(reason).toContain("localhost");
      expect(reason).toContain("blocked");
    });

    it("should return reason for private networks", () => {
      const reason = getSSRFBlockReason("http://192.168.1.1");
      expect(reason).toContain("Private network");
    });

    it("should return reason for invalid protocol", () => {
      const reason = getSSRFBlockReason("ftp://example.com");
      expect(reason).toContain("Protocol");
      expect(reason).toContain("not allowed");
    });

    it("should return reason for .local domains", () => {
      const reason = getSSRFBlockReason("http://server.local");
      expect(reason).toContain("Local domain");
    });

    it("should return reason for invalid URLs", () => {
      const reason = getSSRFBlockReason("not-a-url");
      expect(reason).toBe("Invalid URL format");
    });

    it("should return null for safe URLs", () => {
      const reason = getSSRFBlockReason("https://example.com");
      expect(reason).toBeNull();
    });
  });
});
