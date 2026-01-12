"use client";

import Link from "next/link";
import { ArrowRight, Zap, Shield, Clock, Upload, Download, Video } from "lucide-react";
import { useEffect } from "react";
import { trackViewLanding } from "@/lib/meta-pixel";

const PLATFORMS = [
  { id: "sora", name: "Sora", color: "from-purple-500 to-pink-500" },
  { id: "tiktok", name: "TikTok", color: "from-cyan-500 to-blue-500" },
  { id: "runway", name: "Runway", color: "from-green-500 to-emerald-500" },
  { id: "pika", name: "Pika", color: "from-orange-500 to-red-500" },
  { id: "kling", name: "Kling", color: "from-blue-500 to-indigo-500" },
  { id: "luma", name: "Luma", color: "from-yellow-500 to-orange-500" },
];

export default function Home() {
  useEffect(() => {
    console.log("[PAGE: HOME] 🏠 Homepage loaded");
    console.log("[PAGE: HOME] Available platforms:", PLATFORMS.map(p => p.name).join(", "));
    console.log("[PAGE: HOME] Timestamp:", new Date().toISOString());
    // Track landing page view for Meta Pixel
    trackViewLanding();
  }, []);

  const handlePlatformClick = (platformId: string) => {
    console.log("[PAGE: HOME] 🎯 Platform clicked:", platformId);
  };

  const handleCTAClick = (action: string) => {
    console.log("[PAGE: HOME] 🚀 CTA clicked:", action);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-black text-white">
      {/* Header */}
      <header className="container mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <span className="text-xl font-bold">B</span>
          </div>
          <span className="text-xl font-bold">BlankLogo</span>
        </div>
        <nav className="flex items-center gap-6">
          <Link href="/pricing" className="text-gray-300 hover:text-white transition">
            Pricing
          </Link>
          <Link href="#platforms" className="text-gray-300 hover:text-white transition">
            Platforms
          </Link>
          <Link
            href="/signup"
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 transition font-medium"
          >
            Get Started
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm mb-6">
          <Zap className="w-4 h-4" />
          <span>Ad-Free Premium Tool</span>
        </div>
        
        <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
          Remove Watermarks<br />Fast, Clean, Ad-Free
        </h1>
        
        <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-8">
          Upload a video (or paste a link). BlankLogo detects the platform watermark and delivers a clean export - no re-encoding, no quality loss.
        </p>
        
        <div className="flex flex-wrap justify-center gap-4 text-sm text-gray-300 mb-10">
          <span className="flex items-center gap-2"><Clock className="w-4 h-4 text-indigo-400" /> 5-15s processing</span>
          <span className="flex items-center gap-2"><Video className="w-4 h-4 text-indigo-400" /> Quality preserved</span>
          <span className="flex items-center gap-2"><Shield className="w-4 h-4 text-indigo-400" /> Ad-free experience</span>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/app"
            className="px-8 py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 transition font-semibold text-lg flex items-center gap-2"
          >
            Remove Watermark <ArrowRight className="w-5 h-5" />
          </Link>
          <Link
            href="#how-it-works"
            className="px-8 py-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition font-semibold text-lg"
          >
            See How It Works
          </Link>
        </div>

        {/* Platform Pills */}
        <div className="flex flex-wrap justify-center gap-3 mt-12">
          {PLATFORMS.map((platform) => (
            <Link
              key={platform.id}
              href={`/remove/${platform.id}`}
              className={`px-4 py-2 rounded-full bg-gradient-to-r ${platform.color} text-white text-sm font-medium hover:opacity-90 transition`}
            >
              {platform.name} Watermark
            </Link>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="container mx-auto px-6 py-24">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
          Remove Watermarks in 3 Steps
        </h2>
        
        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {[
            {
              step: "1",
              title: "Upload Your Video",
              description: "Drag and drop or paste a URL. We support MP4, MOV, WebM up to 500MB.",
              icon: <Upload className="w-8 h-8" />,
            },
            {
              step: "2",
              title: "Auto-Detect Platform",
              description: "We automatically detect the watermark type and apply the perfect crop settings.",
              icon: <Zap className="w-8 h-8" />,
            },
            {
              step: "3",
              title: "Download Clean Video",
              description: "Get your watermark-free video in seconds. Original quality preserved.",
              icon: <Download className="w-8 h-8" />,
            },
          ].map((feature) => (
            <div
              key={feature.step}
              className="p-8 rounded-2xl bg-white/5 border border-white/10 hover:border-indigo-500/50 transition text-center"
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                {feature.icon}
              </div>
              <div className="text-sm text-indigo-400 font-medium mb-2">Step {feature.step}</div>
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-gray-400">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Supported Platforms */}
      <section id="platforms" className="container mx-auto px-6 py-24 border-t border-white/10">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
          Supported Platforms
        </h2>
        <p className="text-gray-400 text-center mb-16 max-w-2xl mx-auto">
          Remove watermarks from all major AI video generators and social platforms
        </p>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {[
            { name: "Sora", desc: "OpenAI's text-to-video AI", pixels: 100, href: "/remove/sora" },
            { name: "TikTok", desc: "TikTok video watermarks", pixels: 80, href: "/remove/tiktok" },
            { name: "Runway", desc: "Runway Gen-2 videos", pixels: 60, href: "/remove/runway" },
            { name: "Pika", desc: "Pika Labs AI videos", pixels: 50, href: "/remove/pika" },
            { name: "Kling", desc: "Kuaishou Kling AI", pixels: 70, href: "/remove/kling" },
            { name: "Luma", desc: "Dream Machine videos", pixels: 55, href: "/remove/luma" },
          ].map((platform) => (
            <Link
              key={platform.name}
              href={platform.href}
              className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-indigo-500/50 hover:bg-white/10 transition group"
            >
              <h3 className="text-xl font-semibold mb-2 group-hover:text-indigo-400 transition">
                {platform.name}
              </h3>
              <p className="text-gray-400 text-sm mb-3">{platform.desc}</p>
              <span className="text-xs text-gray-500">Remove {platform.name} watermark fast</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-6 py-24 border-t border-white/10">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
          Why Creators Choose BlankLogo
        </h2>
        
        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="text-center p-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
              <Zap className="w-8 h-8 text-indigo-400" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Ad-Free Premium</h3>
            <p className="text-gray-400">
              No popups, no "wait timers," no sketchy redirects. Just upload and go.
            </p>
          </div>
          
          <div className="text-center p-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
              <Video className="w-8 h-8 text-indigo-400" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Original Quality</h3>
            <p className="text-gray-400">
              No re-encoding. Audio preserved. Your video stays crisp and clear.
            </p>
          </div>
          
          <div className="text-center p-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
              <Shield className="w-8 h-8 text-indigo-400" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Private & Secure</h3>
            <p className="text-gray-400">
              Videos auto-delete after 7 days. We never share your content.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-6 py-24">
        <div className="max-w-4xl mx-auto p-12 rounded-3xl bg-gradient-to-r from-indigo-600 to-purple-600 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to Clean Your Videos?
          </h2>
          <p className="text-xl text-white/80 mb-8">
            10 free credits (one-time). No credit card required.
          </p>
          <Link
            href="/app"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-white text-indigo-600 font-semibold text-lg hover:bg-gray-100 transition"
          >
            Remove Watermark Free <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-6 py-12 border-t border-white/10">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-gray-500">&copy; {new Date().getFullYear()} BlankLogo. All rights reserved.</p>
          <div className="flex gap-6 text-sm text-gray-400">
            <Link href="/privacy" className="hover:text-white transition">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-white transition">Terms of Service</Link>
            <a href="mailto:support@blanklogo.app" className="hover:text-white transition">Contact</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
