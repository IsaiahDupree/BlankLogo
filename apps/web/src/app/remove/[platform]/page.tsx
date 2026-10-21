import Link from "next/link";
import { ArrowRight, Upload, Download, Zap, CheckCircle } from "lucide-react";
import { notFound } from "next/navigation";

const PLATFORMS: Record<string, {
  name: string;
  color: string;
  gradient: string;
  cropPixels: number;
}> = {
  sora: {
    name: "Sora",
    color: "purple",
    gradient: "from-purple-500 to-pink-500",
    cropPixels: 100,
  },
  tiktok: {
    name: "TikTok",
    color: "cyan",
    gradient: "from-cyan-500 to-blue-500",
    cropPixels: 80,
  },
  runway: {
    name: "Runway",
    color: "green",
    gradient: "from-green-500 to-emerald-500",
    cropPixels: 60,
  },
  pika: {
    name: "Pika",
    color: "orange",
    gradient: "from-orange-500 to-red-500",
    cropPixels: 50,
  },
  kling: {
    name: "Kling",
    color: "blue",
    gradient: "from-blue-500 to-indigo-500",
    cropPixels: 70,
  },
  luma: {
    name: "Luma",
    color: "yellow",
    gradient: "from-yellow-500 to-orange-500",
    cropPixels: 55,
  },
};

function platformDescription(platform: (typeof PLATFORMS)[string]): string {
  return `BlankLogo's ${platform.name} preset uses a ${platform.cropPixels}px bottom crop in crop mode. Cropping changes the picture frame and re-encodes video. Use this workflow only for content you own or have permission to edit, and review the result before downloading.`;
}

export async function generateMetadata({ params }: { params: { platform: string } }) {
  const platform = PLATFORMS[params.platform];
  if (!platform) return { title: "Platform Not Found" };
  
  return {
    title: `BlankLogo ${platform.name} Video Processing Guide`,
    description: platformDescription(platform),
    alternates: { canonical: `https://www.blanklogo.app/remove/${params.platform}` },
  };
}

export default function PlatformPage({ params }: { params: { platform: string } }) {
  const platform = PLATFORMS[params.platform];
  
  if (!platform) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-black text-white">
      {/* Header */}
      <header className="container mx-auto px-6 py-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <span className="text-xl font-bold">B</span>
          </div>
          <span className="text-xl font-bold">BlankLogo</span>
        </Link>
        <nav className="flex items-center gap-6">
          <Link href="/pricing" className="text-gray-300 hover:text-white transition">
            Pricing
          </Link>
          <Link
            href="/login"
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 transition font-medium"
          >
            Get Started
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-6 py-16 text-center">
        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r ${platform.gradient} text-white text-sm mb-6`}>
          <Zap className="w-4 h-4" />
          <span>{platform.name} Video Processing Guide</span>
        </div>
        
        <h1 className="text-4xl md:text-6xl font-bold mb-6">
          Process {platform.name} Videos<br />
          <span className={`bg-gradient-to-r ${platform.gradient} bg-clip-text text-transparent`}>
            With BlankLogo
          </span>
        </h1>
        
        <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10">
          {platformDescription(platform)}
        </p>
        
        <Link
          href="/app"
          className={`inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r ${platform.gradient} text-white font-semibold text-lg hover:opacity-90 transition`}
        >
          Remove {platform.name} Watermark <ArrowRight className="w-5 h-5" />
        </Link>
      </section>

      {/* Features */}
      <section className="container mx-auto px-6 py-16">
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-6">
          {[
            `Crop mode default: ${platform.cropPixels}px from the bottom edge.`,
            "Cropping changes the video frame and the output is re-encoded.",
            "Watermark placement and framing vary; inspect the processed result.",
            "Only process videos you own or have permission to modify.",
          ].map((feature, i) => (
            <div key={i} className="flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
              <CheckCircle className={`w-6 h-6 text-${platform.color}-400 flex-shrink-0 mt-0.5`} />
              <span className="text-gray-300">{feature}</span>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="container mx-auto px-6 py-16 border-t border-white/10">
        <h2 className="text-3xl font-bold text-center mb-12">
          How to Remove {platform.name} Watermarks
        </h2>
        
        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="text-center p-6">
            <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-r ${platform.gradient} flex items-center justify-center`}>
              <Upload className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold mb-2">1. Upload Video</h3>
            <p className="text-gray-400">
              Upload your {platform.name} video or paste a URL
            </p>
          </div>
          
          <div className="text-center p-6">
            <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-r ${platform.gradient} flex items-center justify-center`}>
              <Zap className="w-8 h-8 text-white" />
            </div>
          <h3 className="text-xl font-semibold mb-2">2. Select the Preset</h3>
            <p className="text-gray-400">
              In crop mode, the {platform.name} preset starts with a {platform.cropPixels}px bottom crop. Check the crop against your video before processing.
            </p>
          </div>
          
          <div className="text-center p-6">
            <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-r ${platform.gradient} flex items-center justify-center`}>
              <Download className="w-8 h-8 text-white" />
            </div>
          <h3 className="text-xl font-semibold mb-2">3. Review and Download</h3>
            <p className="text-gray-400">
              Review framing and quality in the processed export before you download it.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-6 py-16">
        <div className={`max-w-4xl mx-auto p-12 rounded-3xl bg-gradient-to-r ${platform.gradient} text-center`}>
          <h2 className="text-3xl font-bold mb-4">
            Ready to Process Your {platform.name} Video?
          </h2>
          <p className="text-xl text-white/80 mb-8">
            Use the preset only on content you own or are authorized to modify.
          </p>
          <Link
            href="/app"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-white text-gray-900 font-semibold text-lg hover:bg-gray-100 transition"
          >
            Open BlankLogo <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Other Platforms */}
      <section className="container mx-auto px-6 py-16 border-t border-white/10">
        <h2 className="text-2xl font-bold text-center mb-8">
          Also Remove Watermarks From
        </h2>
        <div className="flex flex-wrap justify-center gap-3">
          {Object.entries(PLATFORMS)
            .filter(([key]) => key !== params.platform)
            .map(([key, p]) => (
              <Link
                key={key}
                href={`/remove/${key}`}
                className={`px-4 py-2 rounded-full bg-gradient-to-r ${p.gradient} text-white text-sm font-medium hover:opacity-90 transition`}
              >
                {p.name}
              </Link>
            ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-6 py-8 border-t border-white/10 text-center text-gray-500">
        <p>&copy; {new Date().getFullYear()} BlankLogo. All rights reserved.</p>
      </footer>
    </main>
  );
}
