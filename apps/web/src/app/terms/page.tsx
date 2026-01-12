"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-black text-white">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        <h1 className="text-4xl font-bold mb-2">Terms of Service</h1>
        <p className="text-gray-400 mb-8">
          Effective Date: January 12, 2026 | Last Updated: January 12, 2026
        </p>

        <div className="prose prose-invert prose-lg max-w-none">
          <p className="lead text-xl text-gray-300">
            Welcome to BlankLogo. By accessing or using our service at blanklogo.app (the &quot;Service&quot;), you agree to be bound by these Terms of Service (&quot;Terms&quot;). Please read them carefully.
          </p>

          <hr className="border-gray-700 my-8" />

          <h2 className="text-2xl font-bold mt-8 mb-4">1. Acceptance of Terms</h2>
          <p className="text-gray-300">
            By creating an account or using the Service, you agree to these Terms and our <Link href="/privacy" className="text-indigo-400 hover:text-indigo-300">Privacy Policy</Link>. If you do not agree, do not use the Service.
          </p>

          <hr className="border-gray-700 my-8" />

          <h2 className="text-2xl font-bold mt-8 mb-4">2. Description of Service</h2>
          <p className="text-gray-300">
            BlankLogo provides tools to remove watermarks from videos using cropping and AI-based inpainting techniques. The Service includes:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-300">
            <li>Video upload and URL-based processing</li>
            <li>Watermark removal via Crop or Inpaint modes</li>
            <li>Temporary storage of processed videos</li>
            <li>Credit-based usage system</li>
          </ul>

          <hr className="border-gray-700 my-8" />

          <h2 className="text-2xl font-bold mt-8 mb-4">3. Account Registration</h2>
          <p className="text-gray-300">To use the Service, you must:</p>
          <ul className="list-disc pl-6 space-y-2 text-gray-300">
            <li>Create an account with a valid email address</li>
            <li>Be at least 13 years old (or 16 in certain jurisdictions)</li>
            <li>Provide accurate information</li>
            <li>Keep your account credentials secure</li>
          </ul>
          <p className="text-gray-300 mt-4">
            You are responsible for all activity under your account. Notify us immediately if you suspect unauthorized use.
          </p>

          <hr className="border-gray-700 my-8" />

          <h2 className="text-2xl font-bold mt-8 mb-4">4. Acceptable Use</h2>
          <p className="text-gray-300">You agree NOT to:</p>
          <ul className="list-disc pl-6 space-y-2 text-gray-300">
            <li>Upload content you do not have rights to use or modify</li>
            <li>Use the Service to infringe copyrights, trademarks, or other intellectual property rights</li>
            <li>Upload illegal, harmful, or objectionable content</li>
            <li>Attempt to bypass security measures or abuse the Service</li>
            <li>Use automated tools to scrape or overload the Service</li>
            <li>Resell or redistribute the Service without authorization</li>
            <li>Use the Service to deceive others about the origin of content</li>
          </ul>

          <div className="bg-red-900/20 border border-red-600/30 rounded-lg p-4 my-4">
            <p className="text-red-200 text-sm">
              <strong>Important:</strong> You are solely responsible for ensuring you have the legal right to modify any content you upload. Removing watermarks from content you do not own or have permission to modify may violate copyright laws.
            </p>
          </div>

          <hr className="border-gray-700 my-8" />

          <h2 className="text-2xl font-bold mt-8 mb-4">5. Credits and Payments</h2>
          
          <h3 className="text-xl font-semibold mt-6 mb-3">A. Credit System</h3>
          <ul className="list-disc pl-6 space-y-2 text-gray-300">
            <li>Processing videos requires credits</li>
            <li>Credits can be purchased or earned through promotions</li>
            <li>Credits are non-refundable except where required by law</li>
            <li>Unused credits do not expire</li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-3">B. Failed Jobs</h3>
          <p className="text-gray-300">
            If a job fails due to a system error, reserved credits are automatically refunded to your account.
          </p>

          <h3 className="text-xl font-semibold mt-6 mb-3">C. Subscriptions</h3>
          <ul className="list-disc pl-6 space-y-2 text-gray-300">
            <li>Subscriptions renew automatically unless cancelled</li>
            <li>You can cancel anytime from your account settings</li>
            <li>Refunds are handled according to our refund policy</li>
          </ul>

          <hr className="border-gray-700 my-8" />

          <h2 className="text-2xl font-bold mt-8 mb-4">6. Content Ownership</h2>
          
          <h3 className="text-xl font-semibold mt-6 mb-3">A. Your Content</h3>
          <p className="text-gray-300">
            You retain ownership of videos you upload. By using the Service, you grant us a limited license to process, store, and deliver your content solely to provide the Service.
          </p>

          <h3 className="text-xl font-semibold mt-6 mb-3">B. Our Service</h3>
          <p className="text-gray-300">
            BlankLogo and its underlying technology, branding, and content are owned by us. These Terms do not grant you rights to our intellectual property except as needed to use the Service.
          </p>

          <hr className="border-gray-700 my-8" />

          <h2 className="text-2xl font-bold mt-8 mb-4">7. Data Retention</h2>
          <ul className="list-disc pl-6 space-y-2 text-gray-300">
            <li>Uploaded videos and outputs are automatically deleted after <strong>7 days</strong> by default</li>
            <li>Paid plans may extend download availability (30 or 90 days)</li>
            <li>You can request earlier deletion by contacting us</li>
            <li>We may retain job metadata for analytics, security, and billing purposes</li>
          </ul>

          <hr className="border-gray-700 my-8" />

          <h2 className="text-2xl font-bold mt-8 mb-4">8. Disclaimers</h2>
          <p className="text-gray-300">
            THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-300">
            <li>Merchantability or fitness for a particular purpose</li>
            <li>Uninterrupted or error-free operation</li>
            <li>Accuracy or completeness of results</li>
          </ul>
          <p className="text-gray-300 mt-4">
            We do not guarantee that watermark removal will be perfect or suitable for your needs.
          </p>

          <hr className="border-gray-700 my-8" />

          <h2 className="text-2xl font-bold mt-8 mb-4">9. Limitation of Liability</h2>
          <p className="text-gray-300">
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, BLANKLOGO SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, OR GOODWILL, ARISING FROM YOUR USE OF THE SERVICE.
          </p>
          <p className="text-gray-300 mt-4">
            Our total liability shall not exceed the amount you paid us in the 12 months preceding the claim.
          </p>

          <hr className="border-gray-700 my-8" />

          <h2 className="text-2xl font-bold mt-8 mb-4">10. Indemnification</h2>
          <p className="text-gray-300">
            You agree to indemnify and hold harmless BlankLogo and its affiliates from any claims, damages, or expenses arising from:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-300">
            <li>Your use of the Service</li>
            <li>Content you upload or process</li>
            <li>Your violation of these Terms</li>
            <li>Your violation of any third-party rights</li>
          </ul>

          <hr className="border-gray-700 my-8" />

          <h2 className="text-2xl font-bold mt-8 mb-4">11. Termination</h2>
          <p className="text-gray-300">
            We may suspend or terminate your account if you violate these Terms. You may delete your account at any time. Upon termination:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-300">
            <li>Your right to use the Service ends immediately</li>
            <li>We may delete your content</li>
            <li>Unused credits are forfeited unless required otherwise by law</li>
          </ul>

          <hr className="border-gray-700 my-8" />

          <h2 className="text-2xl font-bold mt-8 mb-4">12. DMCA / Copyright Policy</h2>
          <p className="text-gray-300">
            We respect intellectual property rights. If you believe content on our Service infringes your copyright, contact us at <a href="mailto:legal@blanklogo.app" className="text-indigo-400 hover:text-indigo-300">legal@blanklogo.app</a> with:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-300">
            <li>Identification of the copyrighted work</li>
            <li>Identification of the infringing content</li>
            <li>Your contact information</li>
            <li>A statement of good faith belief</li>
            <li>A statement of accuracy under penalty of perjury</li>
            <li>Your signature (physical or electronic)</li>
          </ul>

          <hr className="border-gray-700 my-8" />

          <h2 className="text-2xl font-bold mt-8 mb-4">13. Changes to Terms</h2>
          <p className="text-gray-300">
            We may update these Terms from time to time. If changes are material, we will notify you (e.g., via email or on the site). Continued use after changes constitutes acceptance.
          </p>

          <hr className="border-gray-700 my-8" />

          <h2 className="text-2xl font-bold mt-8 mb-4">14. Governing Law</h2>
          <p className="text-gray-300">
            These Terms are governed by the laws of the State of Delaware, United States, without regard to conflict of law principles. Any disputes shall be resolved in the courts of Delaware.
          </p>

          <hr className="border-gray-700 my-8" />

          <h2 className="text-2xl font-bold mt-8 mb-4">15. Contact Us</h2>
          <div className="bg-gray-800/50 rounded-lg p-6 mt-4">
            <p className="text-white font-semibold text-lg mb-4">BlankLogo</p>
            <p className="text-gray-300">
              Email: <a href="mailto:support@blanklogo.app" className="text-indigo-400 hover:text-indigo-300">support@blanklogo.app</a><br />
              Legal: <a href="mailto:legal@blanklogo.app" className="text-indigo-400 hover:text-indigo-300">legal@blanklogo.app</a>
            </p>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-800">
          <div className="flex flex-wrap gap-4 text-sm text-gray-400">
            <Link href="/terms" className="hover:text-white transition">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-white transition">Privacy Policy</Link>
            <Link href="/" className="hover:text-white transition">Home</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
