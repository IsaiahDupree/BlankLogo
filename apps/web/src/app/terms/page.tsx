import type { Metadata } from "next";
import TermsClient from "./terms-client";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms governing use of the BlankLogo video processing service.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return <TermsClient />;
}
