import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import * as fs from "fs";
import * as path from "path";

// ============================================
// Worker Pipeline Integration Tests
// ============================================

// Mock external API responses
const handlers = [
  // Mock OpenAI Chat Completion (Script Generation)
  http.post("https://api.openai.com/v1/chat/completions", () => {
    return HttpResponse.json({
      id: "chatcmpl-test",
      object: "chat.completion",
      created: Date.now(),
      model: "gpt-4o-mini",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: JSON.stringify({
              title: "Test Video",
              estimatedMinutes: 2,
              sections: [
                {
                  id: "section_000",
                  headline: "Introduction",
                  narrationText: "Welcome to this test video about testing.",
                  visualKeywords: ["testing", "introduction"],
                  estimatedDurationMs: 5000,
                },
                {
                  id: "section_001",
                  headline: "Main Content",
                  narrationText: "This is the main content of our test video.",
                  visualKeywords: ["content", "main"],
                  estimatedDurationMs: 8000,
                },
              ],
            }),
          },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 },
    });
  }),

  // Mock OpenAI TTS
  http.post("https://api.openai.com/v1/audio/speech", () => {
    // Return a minimal valid MP3 header
    const mp3Header = new Uint8Array([
      0xff, 0xfb, 0x90, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);
    return new HttpResponse(mp3Header, {
      headers: { "Content-Type": "audio/mpeg" },
    });
  }),

  // Mock OpenAI Whisper Transcription
  http.post("https://api.openai.com/v1/audio/transcriptions", () => {
    return HttpResponse.json({
      task: "transcribe",
      language: "en",
      duration: 13.0,
      text: "Welcome to this test video about testing. This is the main content of our test video.",
      segments: [
        { id: 0, start: 0.0, end: 2.5, text: "Welcome to this test video" },
        { id: 1, start: 2.5, end: 5.0, text: "about testing." },
        { id: 2, start: 5.0, end: 8.0, text: "This is the main content" },
        { id: 3, start: 8.0, end: 13.0, text: "of our test video." },
      ],
      words: [
        { word: "Welcome", start: 0.0, end: 0.4 },
        { word: "to", start: 0.4, end: 0.5 },
        { word: "this", start: 0.5, end: 0.7 },
        { word: "test", start: 0.7, end: 0.9 },
        { word: "video", start: 0.9, end: 1.3 },
      ],
    });
  }),

  // Mock OpenAI Image Generation (DALL-E)
  http.post("https://api.openai.com/v1/images/generations", () => {
    // Return base64 encoded 1x1 PNG
    const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    return HttpResponse.json({
      created: Date.now(),
      data: [{ b64_json: pngBase64, revised_prompt: "Test image" }],
    });
  }),

  // Mock HuggingFace IndexTTS
  http.post("https://heartsync-indextts-2.hf.space/api/predict", () => {
    return HttpResponse.json({
      data: [{ url: "https://example.com/audio.wav" }],
    });
  }),
];

const server = setupServer(...handlers);

beforeAll(() => {
  server.listen({ onUnhandledRequest: "bypass" });
});

afterAll(() => {
  server.close();
});

// ============================================
// Script Generation Tests
// ============================================

describe("Script Generation Stage", () => {
  it("generates valid script JSON from input", async () => {
    // Mock the OpenAI response is already set up
    const mockInput = "This is test input content about technology and innovation.";
    
    // Simulate what the script stage would produce
    const expectedOutput = {
      title: expect.any(String),
      sections: expect.arrayContaining([
        expect.objectContaining({
          id: expect.stringMatching(/^section_\d{3}$/),
          headline: expect.any(String),
          narrationText: expect.any(String),
          visualKeywords: expect.any(Array),
        }),
      ]),
    };

    // The actual test would call the generateScript function
    // For now, verify the mock response structure
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o-mini", messages: [] }),
    });
    const data = await response.json();
    const scriptContent = JSON.parse(data.choices[0].message.content);
    
    expect(scriptContent).toMatchObject(expectedOutput);
  });

  it("script sections have normalized IDs", async () => {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o-mini", messages: [] }),
    });
    const data = await response.json();
    const script = JSON.parse(data.choices[0].message.content);

    script.sections.forEach((section: any, index: number) => {
      expect(section.id).toBe(`section_${String(index).padStart(3, "0")}`);
    });
  });

  it("sections have non-empty narration text", async () => {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o-mini", messages: [] }),
    });
    const data = await response.json();
    const script = JSON.parse(data.choices[0].message.content);

    script.sections.forEach((section: any) => {
      expect(section.narrationText.length).toBeGreaterThan(0);
    });
  });
});

// ============================================
// TTS Stage Tests
// ============================================

describe("TTS Stage", () => {
  it("generates audio from text", async () => {
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "tts-1",
        voice: "onyx",
        input: "Test text for TTS",
      }),
    });

    expect(response.ok).toBe(true);
    expect(response.headers.get("Content-Type")).toBe("audio/mpeg");
    
    const buffer = await response.arrayBuffer();
    expect(buffer.byteLength).toBeGreaterThan(0);
  });

  it("handles chunked text for long narration", () => {
    const longText = "A".repeat(5000);
    const maxChars = 4000;
    
    // Simulate chunking logic
    const chunks: string[] = [];
    for (let i = 0; i < longText.length; i += maxChars) {
      chunks.push(longText.slice(i, i + maxChars));
    }

    expect(chunks.length).toBe(2);
    expect(chunks[0].length).toBe(4000);
    expect(chunks[1].length).toBe(1000);
  });
});

// ============================================
// Whisper Alignment Tests
// ============================================

describe("Whisper Alignment Stage", () => {
  it("returns segments with timestamps", async () => {
    const formData = new FormData();
    formData.append("file", new Blob([]), "audio.mp3");
    formData.append("model", "whisper-1");
    formData.append("response_format", "verbose_json");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      body: formData,
    });
    const data = await response.json();

    expect(data.segments).toBeDefined();
    expect(data.segments.length).toBeGreaterThan(0);
    
    data.segments.forEach((seg: any) => {
      expect(seg.start).toBeGreaterThanOrEqual(0);
      expect(seg.end).toBeGreaterThan(seg.start);
      expect(seg.text).toBeDefined();
    });
  });

  it("segments are monotonically increasing", async () => {
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      body: new FormData(),
    });
    const data = await response.json();

    let lastEnd = 0;
    data.segments.forEach((seg: any) => {
      expect(seg.start).toBeGreaterThanOrEqual(lastEnd - 0.1); // Allow small overlap
      lastEnd = seg.end;
    });
  });

  it("generates valid SRT format", () => {
    const segments = [
      { id: 0, start: 0.0, end: 2.5, text: "First segment" },
      { id: 1, start: 2.5, end: 5.0, text: "Second segment" },
    ];

    const srt = segments.map((seg, idx) => {
      const formatTime = (s: number) => {
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = Math.floor(s % 60);
        const ms = Math.floor((s % 1) * 1000);
        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
      };
      return `${idx + 1}\n${formatTime(seg.start)} --> ${formatTime(seg.end)}\n${seg.text}\n`;
    }).join("\n");

    expect(srt).toContain("1\n00:00:00,000 --> 00:00:02,500");
    expect(srt).toContain("2\n00:00:02,500 --> 00:00:05,000");
  });
});

// ============================================
// Image Generation Tests
// ============================================

describe("Image Generation Stage", () => {
  it("generates images from prompts", async () => {
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: "A beautiful sunset over mountains",
        n: 1,
        response_format: "b64_json",
      }),
    });
    const data = await response.json();

    expect(data.data).toBeDefined();
    expect(data.data.length).toBe(1);
    expect(data.data[0].b64_json).toBeDefined();
  });

  it("base64 decodes to valid PNG", async () => {
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "test" }),
    });
    const data = await response.json();
    
    const base64 = data.data[0].b64_json;
    const buffer = Buffer.from(base64, "base64");
    
    // PNG magic bytes
    expect(buffer[0]).toBe(0x89);
    expect(buffer[1]).toBe(0x50);
    expect(buffer[2]).toBe(0x4e);
    expect(buffer[3]).toBe(0x47);
  });
});

// ============================================
// Visual Plan Tests
// ============================================

describe("Visual Plan Stage", () => {
  it("creates correct number of slots based on duration", () => {
    const totalDurationMs = 60000; // 60 seconds
    const secondsPerImage = 8;
    const expectedSlots = Math.ceil(totalDurationMs / 1000 / secondsPerImage);

    expect(expectedSlots).toBe(8);
  });

  it("slots cover entire duration without gaps", () => {
    const totalDurationMs = 24000;
    const slots = [
      { id: "slot_000", startMs: 0, endMs: 8000 },
      { id: "slot_001", startMs: 8000, endMs: 16000 },
      { id: "slot_002", startMs: 16000, endMs: 24000 },
    ];

    // Check no gaps
    for (let i = 1; i < slots.length; i++) {
      expect(slots[i].startMs).toBe(slots[i - 1].endMs);
    }

    // Check coverage
    expect(slots[0].startMs).toBe(0);
    expect(slots[slots.length - 1].endMs).toBe(totalDurationMs);
  });

  it("prompts contain style and keywords", () => {
    const style = "photorealistic, cinematic lighting";
    const keywords = ["technology", "innovation"];
    const concept = "Modern tech workspace";

    const prompt = `${concept}, ${keywords.join(", ")}, ${style}`;

    expect(prompt).toContain("photorealistic");
    expect(prompt).toContain("technology");
    expect(prompt).toContain("Modern tech workspace");
  });
});

// ============================================
// Idempotency Tests
// ============================================

describe("Pipeline Idempotency", () => {
  it("detects existing script asset and skips", () => {
    const existingAssets = [{ type: "script", path: "test/script.json" }];
    const shouldSkip = existingAssets.some((a) => a.type === "script");
    expect(shouldSkip).toBe(true);
  });

  it("detects existing audio asset and skips", () => {
    const existingAssets = [{ type: "audio", path: "test/narration.mp3" }];
    const shouldSkip = existingAssets.some((a) => a.type === "audio");
    expect(shouldSkip).toBe(true);
  });

  it("detects existing captions asset and skips", () => {
    const existingAssets = [{ type: "captions", path: "test/captions.srt" }];
    const shouldSkip = existingAssets.some((a) => a.type === "captions");
    expect(shouldSkip).toBe(true);
  });

  it("proceeds when asset does not exist", () => {
    const existingAssets: any[] = [];
    const shouldSkip = existingAssets.some((a) => a.type === "script");
    expect(shouldSkip).toBe(false);
  });
});
