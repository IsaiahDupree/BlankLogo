import type { Metadata } from "next";
import HomeClient from "./home-client";

export const metadata: Metadata = {
  title: "Video Watermark Removal",
  description:
    "BlankLogo is a video watermark removal tool. Upload a supported video or submit a URL, review the result, and download your export.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "https://www.blanklogo.app/",
    title: "BlankLogo | Video Watermark Removal",
    description:
      "Upload a supported video or submit a URL, review the result, and download your export.",
    siteName: "BlankLogo",
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://www.blanklogo.app/#publisher",
      name: "Dupree Ops LLC",
      url: "https://dupreeops.com/",
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://www.blanklogo.app/#software",
      name: "BlankLogo",
      url: "https://www.blanklogo.app/",
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Web",
      description: metadata.description,
      publisher: { "@id": "https://www.blanklogo.app/#publisher" },
    },
  ],
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
      <HomeClient />
    </>
  );
}
