import { describe, it, expect } from "vitest";

// ============================================
// Upload Security Tests
// ============================================

const ALLOWED_EXTENSIONS = [".txt", ".md", ".pdf", ".docx", ".doc"];
const ALLOWED_MIME_TYPES = [
  "text/plain",
  "text/markdown",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function validateFileExtension(filename: string): boolean {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf("."));
  return ALLOWED_EXTENSIONS.includes(ext);
}

function validateMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.includes(mimeType);
}

function validateFileSize(size: number): boolean {
  return size > 0 && size <= MAX_FILE_SIZE;
}

function sanitizeFilename(filename: string): string {
  // Remove path traversal attempts
  let sanitized = filename.replace(/\.\./g, "");
  // Remove directory separators
  sanitized = sanitized.replace(/[\/\\]/g, "");
  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, "");
  // Remove special characters except dots, dashes, underscores
  sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, "_");
  return sanitized;
}

describe("Upload File Extension Validation", () => {
  it("allows .txt files", () => {
    expect(validateFileExtension("document.txt")).toBe(true);
  });

  it("allows .md files", () => {
    expect(validateFileExtension("readme.md")).toBe(true);
  });

  it("allows .pdf files", () => {
    expect(validateFileExtension("report.pdf")).toBe(true);
  });

  it("allows .docx files", () => {
    expect(validateFileExtension("document.docx")).toBe(true);
  });

  it("blocks .exe files", () => {
    expect(validateFileExtension("malware.exe")).toBe(false);
  });

  it("blocks .js files", () => {
    expect(validateFileExtension("script.js")).toBe(false);
  });

  it("blocks .php files", () => {
    expect(validateFileExtension("shell.php")).toBe(false);
  });

  it("blocks .html files", () => {
    expect(validateFileExtension("page.html")).toBe(false);
  });

  it("handles case insensitivity", () => {
    expect(validateFileExtension("DOCUMENT.TXT")).toBe(true);
    expect(validateFileExtension("Document.PDF")).toBe(true);
  });

  it("handles double extensions (type confusion)", () => {
    expect(validateFileExtension("image.pdf.exe")).toBe(false);
    expect(validateFileExtension("script.txt.php")).toBe(false);
  });
});

describe("Upload MIME Type Validation", () => {
  it("allows text/plain", () => {
    expect(validateMimeType("text/plain")).toBe(true);
  });

  it("allows application/pdf", () => {
    expect(validateMimeType("application/pdf")).toBe(true);
  });

  it("blocks application/x-executable", () => {
    expect(validateMimeType("application/x-executable")).toBe(false);
  });

  it("blocks text/javascript", () => {
    expect(validateMimeType("text/javascript")).toBe(false);
  });

  it("blocks text/html", () => {
    expect(validateMimeType("text/html")).toBe(false);
  });

  it("blocks application/x-php", () => {
    expect(validateMimeType("application/x-php")).toBe(false);
  });
});

describe("Upload File Size Validation", () => {
  it("allows files under 10MB", () => {
    expect(validateFileSize(1024)).toBe(true); // 1KB
    expect(validateFileSize(1024 * 1024)).toBe(true); // 1MB
    expect(validateFileSize(5 * 1024 * 1024)).toBe(true); // 5MB
  });

  it("allows files exactly 10MB", () => {
    expect(validateFileSize(10 * 1024 * 1024)).toBe(true);
  });

  it("blocks files over 10MB", () => {
    expect(validateFileSize(10 * 1024 * 1024 + 1)).toBe(false);
    expect(validateFileSize(100 * 1024 * 1024)).toBe(false);
  });

  it("blocks zero-size files", () => {
    expect(validateFileSize(0)).toBe(false);
  });

  it("blocks negative sizes", () => {
    expect(validateFileSize(-1)).toBe(false);
  });
});

describe("Filename Sanitization", () => {
  it("removes path traversal sequences", () => {
    expect(sanitizeFilename("../../../etc/passwd")).toBe("etcpasswd");
    expect(sanitizeFilename("..\\..\\windows\\system32")).toBe("windowssystem32");
  });

  it("removes directory separators", () => {
    expect(sanitizeFilename("path/to/file.txt")).toBe("pathtofile.txt");
    expect(sanitizeFilename("path\\to\\file.txt")).toBe("pathtofile.txt");
  });

  it("removes null bytes", () => {
    expect(sanitizeFilename("file\0.txt")).toBe("file.txt");
  });

  it("replaces special characters with underscores", () => {
    expect(sanitizeFilename("file<>name.txt")).toBe("file__name.txt");
    expect(sanitizeFilename("file|name.txt")).toBe("file_name.txt");
  });

  it("preserves valid characters", () => {
    expect(sanitizeFilename("valid-file_name.txt")).toBe("valid-file_name.txt");
    expect(sanitizeFilename("report.2024.pdf")).toBe("report.2024.pdf");
  });
});

describe("Content Type Spoofing Prevention", () => {
  it("detects extension/mimetype mismatch", () => {
    // File claims to be .txt but has executable MIME type
    const ext = validateFileExtension("harmless.txt");
    const mime = validateMimeType("application/x-executable");
    
    // Both should be validated independently
    expect(ext).toBe(true);
    expect(mime).toBe(false);
  });

  it("validates both extension and MIME type together", () => {
    function isValidUpload(filename: string, mimeType: string, size: number): boolean {
      return validateFileExtension(filename) && 
             validateMimeType(mimeType) && 
             validateFileSize(size);
    }

    expect(isValidUpload("doc.txt", "text/plain", 1024)).toBe(true);
    expect(isValidUpload("doc.txt", "application/x-executable", 1024)).toBe(false);
    expect(isValidUpload("doc.exe", "text/plain", 1024)).toBe(false);
    expect(isValidUpload("doc.txt", "text/plain", 100 * 1024 * 1024)).toBe(false);
  });
});
