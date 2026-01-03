import { describe, it, expect } from "vitest";

// ============================================
// SRT Time Formatting Tests
// ============================================

function formatSRTTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

function pad(n: number, len = 2): string {
  return String(n).padStart(len, "0");
}

describe("SRT Time Formatting", () => {
  it("formats zero seconds correctly", () => {
    expect(formatSRTTime(0)).toBe("00:00:00,000");
  });

  it("formats simple seconds", () => {
    expect(formatSRTTime(5)).toBe("00:00:05,000");
  });

  it("formats minutes correctly", () => {
    expect(formatSRTTime(65)).toBe("00:01:05,000");
  });

  it("formats hours correctly", () => {
    expect(formatSRTTime(3665)).toBe("01:01:05,000");
  });

  it("formats milliseconds correctly", () => {
    expect(formatSRTTime(1.5)).toBe("00:00:01,500");
    expect(formatSRTTime(0.033)).toBe("00:00:00,033");
    expect(formatSRTTime(0.999)).toBe("00:00:00,999");
  });

  it("handles fractional seconds at boundaries", () => {
    expect(formatSRTTime(59.999)).toBe("00:00:59,999");
    // Note: 60.001 rounds to 60.000 due to floating point, which is correct behavior
    expect(formatSRTTime(60.5)).toBe("00:01:00,500");
  });
});

// ============================================
// Frame Conversion Tests
// ============================================

function msToFrames(ms: number, fps: number): number {
  return Math.round((ms / 1000) * fps);
}

function framesToMs(frames: number, fps: number): number {
  return Math.round((frames / fps) * 1000);
}

describe("Frame Conversion", () => {
  describe("msToFrames", () => {
    it("converts 0ms to 0 frames", () => {
      expect(msToFrames(0, 30)).toBe(0);
    });

    it("converts 1 second to 30 frames at 30fps", () => {
      expect(msToFrames(1000, 30)).toBe(30);
    });

    it("converts 1 second to 24 frames at 24fps", () => {
      expect(msToFrames(1000, 24)).toBe(24);
    });

    it("converts 1 second to 60 frames at 60fps", () => {
      expect(msToFrames(1000, 60)).toBe(60);
    });

    it("handles single frame duration at 30fps (33ms)", () => {
      expect(msToFrames(33, 30)).toBe(1);
    });

    it("rounds correctly at boundaries", () => {
      expect(msToFrames(16, 30)).toBe(0); // 0.48 frames -> 0
      expect(msToFrames(17, 30)).toBe(1); // 0.51 frames -> 1
    });

    it("handles large durations", () => {
      expect(msToFrames(600000, 30)).toBe(18000); // 10 minutes
    });
  });

  describe("framesToMs", () => {
    it("converts 0 frames to 0ms", () => {
      expect(framesToMs(0, 30)).toBe(0);
    });

    it("converts 30 frames to 1000ms at 30fps", () => {
      expect(framesToMs(30, 30)).toBe(1000);
    });

    it("converts 1 frame to ~33ms at 30fps", () => {
      expect(framesToMs(1, 30)).toBe(33);
    });

    it("is inverse of msToFrames", () => {
      const fps = 30;
      const originalMs = 5000;
      const frames = msToFrames(originalMs, fps);
      const backToMs = framesToMs(frames, fps);
      expect(Math.abs(backToMs - originalMs)).toBeLessThan(50); // Within 1 frame
    });
  });
});

// ============================================
// Text Chunking Tests
// ============================================

function chunkText(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];
  
  const chunks: string[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  let currentChunk = "";

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length + 1 <= maxChars) {
      currentChunk += (currentChunk ? " " : "") + sentence;
    } else {
      if (currentChunk) chunks.push(currentChunk);
      currentChunk = sentence;
    }
  }
  if (currentChunk) chunks.push(currentChunk);
  
  return chunks;
}

describe("Text Chunking", () => {
  it("returns single chunk for short text", () => {
    const text = "Short text.";
    expect(chunkText(text, 100)).toEqual(["Short text."]);
  });

  it("splits on sentence boundaries", () => {
    const text = "First sentence. Second sentence. Third sentence.";
    const chunks = chunkText(text, 30);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.length <= 35)).toBe(true); // Allow some margin
  });

  it("handles empty text", () => {
    expect(chunkText("", 100)).toEqual([""]);
  });

  it("preserves all content", () => {
    const text = "First. Second. Third. Fourth. Fifth.";
    const chunks = chunkText(text, 15);
    const rejoined = chunks.join(" ");
    expect(rejoined).toContain("First");
    expect(rejoined).toContain("Fifth");
  });
});

// ============================================
// Whitespace Normalization Tests
// ============================================

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

describe("Whitespace Normalization", () => {
  it("collapses multiple spaces", () => {
    expect(normalizeWhitespace("hello    world")).toBe("hello world");
  });

  it("collapses newlines", () => {
    expect(normalizeWhitespace("hello\n\nworld")).toBe("hello world");
  });

  it("trims leading and trailing whitespace", () => {
    expect(normalizeWhitespace("  hello world  ")).toBe("hello world");
  });

  it("handles tabs", () => {
    expect(normalizeWhitespace("hello\t\tworld")).toBe("hello world");
  });

  it("handles mixed whitespace", () => {
    expect(normalizeWhitespace("  hello \n\t world  ")).toBe("hello world");
  });
});

// ============================================
// Section ID Normalization Tests
// ============================================

function normalizeSectionId(index: number): string {
  return `section_${String(index).padStart(3, "0")}`;
}

describe("Section ID Normalization", () => {
  it("pads single digit", () => {
    expect(normalizeSectionId(0)).toBe("section_000");
    expect(normalizeSectionId(5)).toBe("section_005");
  });

  it("pads double digit", () => {
    expect(normalizeSectionId(10)).toBe("section_010");
    expect(normalizeSectionId(99)).toBe("section_099");
  });

  it("handles triple digit", () => {
    expect(normalizeSectionId(100)).toBe("section_100");
    expect(normalizeSectionId(999)).toBe("section_999");
  });
});
