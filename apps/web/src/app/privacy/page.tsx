import type { Metadata } from "next";
import PrivacyClient from "./privacy-client";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How BlankLogo handles account, uploaded media, analytics, and service data.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return <PrivacyClient />;
}
