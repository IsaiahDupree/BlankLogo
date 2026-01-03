import { describe, it, expect } from "vitest";

// ============================================
// SSRF Protection Tests
// ============================================

function isBlockedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    // Block localhost variants
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]") {
      return true;
    }

    // Block AWS metadata endpoint
    if (hostname === "169.254.169.254") {
      return true;
    }

    // Block private IP ranges (RFC1918)
    const ipParts = hostname.split(".").map(Number);
    if (ipParts.length === 4 && ipParts.every((p) => !isNaN(p))) {
      // 10.0.0.0/8
      if (ipParts[0] === 10) return true;
      // 172.16.0.0/12
      if (ipParts[0] === 172 && ipParts[1] >= 16 && ipParts[1] <= 31) return true;
      // 192.168.0.0/16
      if (ipParts[0] === 192 && ipParts[1] === 168) return true;
      // 0.0.0.0
      if (ipParts.every((p) => p === 0)) return true;
    }

    // Block file:// protocol
    if (parsed.protocol === "file:") return true;

    // Block ftp://
    if (parsed.protocol === "ftp:") return true;

    return false;
  } catch {
    return true; // Block invalid URLs
  }
}

describe("SSRF Protection", () => {
  describe("Localhost blocking", () => {
    it("blocks http://localhost", () => {
      expect(isBlockedUrl("http://localhost")).toBe(true);
    });

    it("blocks http://localhost:8080", () => {
      expect(isBlockedUrl("http://localhost:8080")).toBe(true);
    });

    it("blocks http://127.0.0.1", () => {
      expect(isBlockedUrl("http://127.0.0.1")).toBe(true);
    });

    it("blocks http://127.0.0.1:3000", () => {
      expect(isBlockedUrl("http://127.0.0.1:3000")).toBe(true);
    });

    it("blocks http://[::1]", () => {
      expect(isBlockedUrl("http://[::1]")).toBe(true);
    });
  });

  describe("AWS metadata endpoint blocking", () => {
    it("blocks http://169.254.169.254", () => {
      expect(isBlockedUrl("http://169.254.169.254")).toBe(true);
    });

    it("blocks http://169.254.169.254/latest/meta-data", () => {
      expect(isBlockedUrl("http://169.254.169.254/latest/meta-data")).toBe(true);
    });
  });

  describe("Private IP range blocking", () => {
    it("blocks 10.0.0.0/8 range", () => {
      expect(isBlockedUrl("http://10.0.0.1")).toBe(true);
      expect(isBlockedUrl("http://10.255.255.255")).toBe(true);
    });

    it("blocks 172.16.0.0/12 range", () => {
      expect(isBlockedUrl("http://172.16.0.1")).toBe(true);
      expect(isBlockedUrl("http://172.31.255.255")).toBe(true);
    });

    it("blocks 192.168.0.0/16 range", () => {
      expect(isBlockedUrl("http://192.168.0.1")).toBe(true);
      expect(isBlockedUrl("http://192.168.255.255")).toBe(true);
    });

    it("blocks 0.0.0.0", () => {
      expect(isBlockedUrl("http://0.0.0.0")).toBe(true);
    });
  });

  describe("Protocol blocking", () => {
    it("blocks file:// protocol", () => {
      expect(isBlockedUrl("file:///etc/passwd")).toBe(true);
    });

    it("blocks ftp:// protocol", () => {
      expect(isBlockedUrl("ftp://example.com")).toBe(true);
    });
  });

  describe("Valid URLs", () => {
    it("allows https://example.com", () => {
      expect(isBlockedUrl("https://example.com")).toBe(false);
    });

    it("allows http://example.com", () => {
      expect(isBlockedUrl("http://example.com")).toBe(false);
    });

    it("allows https://api.openai.com", () => {
      expect(isBlockedUrl("https://api.openai.com")).toBe(false);
    });

    it("allows public IP addresses", () => {
      expect(isBlockedUrl("http://8.8.8.8")).toBe(false);
      expect(isBlockedUrl("http://1.1.1.1")).toBe(false);
    });
  });

  describe("Invalid URLs", () => {
    it("blocks empty string", () => {
      expect(isBlockedUrl("")).toBe(true);
    });

    it("blocks malformed URLs", () => {
      expect(isBlockedUrl("not-a-url")).toBe(true);
      expect(isBlockedUrl("://missing-protocol")).toBe(true);
    });
  });
});
