import { Resend } from "resend";

// Lazy initialization to avoid build-time errors when API key is not set
let _resend: Resend | null = null;

export function getResend(): Resend {
  if (!_resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY environment variable is not set");
    }
    _resend = new Resend(apiKey);
  }
  return _resend;
}

// Keep for backward compatibility but make it lazy
export const resend = {
  get emails() {
    return getResend().emails;
  }
};

export const FROM = process.env.RESEND_FROM || "BlankLogo <hello@blanklogo.com>";
export const BASE_URL = process.env.APP_BASE_URL || "http://localhost:3939";
