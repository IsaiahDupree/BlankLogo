import Link from "next/link";
import { ArrowRight, Play, Sparkles, Download, Mic } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-black text-white">
      {/* Header */}
      <header className="container mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/images/logo-icon.png" alt="CanvasCast" className="w-10 h-10" />
          <span className="text-xl font-bold">CanvasCast</span>
        </div>
        <nav className="flex items-center gap-6">
          <Link href="/pricing" className="text-gray-300 hover:text-white transition">
            Pricing
          </Link>
          <Link
            href="/login"
            className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 transition font-medium"
          >
            Get Started
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-sm mb-6">
          <Sparkles className="w-4 h-4" />
          <span>AI-Powered Video Creation</span>
        </div>
        
        <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
          Turn Your Passion<br />Into Videos
        </h1>
        
        <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10">
          Transform your notes and ideas into professional 10-minute YouTube-ready videos
          with AI-powered narration, stunning visuals, and accurate captions.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/login"
            className="px-8 py-4 rounded-xl bg-brand-600 hover:bg-brand-500 transition font-semibold text-lg flex items-center gap-2"
          >
            Start Creating <ArrowRight className="w-5 h-5" />
          </Link>
          <Link
            href="#how-it-works"
            className="px-8 py-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition font-semibold text-lg"
          >
            See How It Works
          </Link>
        </div>
      </section>

      {/* Features */}
      <section id="how-it-works" className="container mx-auto px-6 py-24">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
          Create Videos in 4 Simple Steps
        </h2>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            {
              step: "1",
              title: "Pick Your Niche",
              description: "Choose from explainer, motivation, facts, history, and more preset styles.",
              icon: "🎯",
            },
            {
              step: "2",
              title: "Add Your Content",
              description: "Paste your notes, upload documents, or describe your video idea.",
              icon: "📝",
            },
            {
              step: "3",
              title: "Choose Your Voice",
              description: "Select from professional voices or bring your own voice to life.",
              icon: "🎙️",
            },
            {
              step: "4",
              title: "Download & Publish",
              description: "Get your MP4, captions, and all assets ready to upload to YouTube.",
              icon: "🚀",
            },
          ].map((feature) => (
            <div
              key={feature.step}
              className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-brand-500/50 transition"
            >
              <div className="text-4xl mb-4">{feature.icon}</div>
              <div className="text-sm text-brand-400 font-medium mb-2">Step {feature.step}</div>
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-gray-400">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* What You Get */}
      <section className="container mx-auto px-6 py-24 border-t border-white/10">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
          Everything You Need to Start
        </h2>
        
        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="text-center p-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-brand-500/10 flex items-center justify-center">
              <Play className="w-8 h-8 text-brand-400" />
            </div>
            <h3 className="text-xl font-semibold mb-2">HD Video</h3>
            <p className="text-gray-400">
              1080p MP4 ready for YouTube, with smooth transitions and animations.
            </p>
          </div>
          
          <div className="text-center p-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-brand-500/10 flex items-center justify-center">
              <Mic className="w-8 h-8 text-brand-400" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Pro Narration</h3>
            <p className="text-gray-400">
              Natural-sounding AI voices with accurate captions (SRT/VTT).
            </p>
          </div>
          
          <div className="text-center p-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-brand-500/10 flex items-center justify-center">
              <Download className="w-8 h-8 text-brand-400" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Full Assets</h3>
            <p className="text-gray-400">
              Download your script, images, audio, and project files.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-6 py-24">
        <div className="max-w-4xl mx-auto p-12 rounded-3xl bg-gradient-to-r from-brand-600 to-brand-500 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to Create Your First Video?
          </h2>
          <p className="text-xl text-white/80 mb-8">
            Start with 10 free minutes. No credit card required.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-white text-brand-600 font-semibold text-lg hover:bg-gray-100 transition"
          >
            Get Started Free <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-6 py-8 border-t border-white/10 text-center text-gray-500">
        <p>&copy; {new Date().getFullYear()} CanvasCast. All rights reserved.</p>
      </footer>
    </main>
  );
}
