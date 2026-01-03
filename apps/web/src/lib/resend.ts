import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY);

export const FROM = process.env.RESEND_FROM || "BlankLogo <hello@blanklogo.com>";
export const BASE_URL = process.env.APP_BASE_URL || "http://localhost:3939";
