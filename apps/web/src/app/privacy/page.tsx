"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPolicyPage() {
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

        <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-gray-400 mb-8">
          Effective Date: January 12, 2026 | Last Updated: January 12, 2026
        </p>

        <div className="prose prose-invert prose-lg max-w-none">
          <p className="lead text-xl text-gray-300">
            BlankLogo (&quot;BlankLogo,&quot; &quot;we,&quot; &quot;us,&quot; &quot;our&quot;) provides a web-based service for removing watermarks from videos (the &quot;Service&quot;). This Privacy Policy explains how we collect, use, share, and protect information when you visit blanklogo.app or use the Service.
          </p>

          <p className="text-gray-400">
            If you do not agree with this Privacy Policy, please do not use the Service.
          </p>

          <hr className="border-gray-700 my-8" />

          <h2 className="text-2xl font-bold mt-8 mb-4">1) What We Collect</h2>

          <h3 className="text-xl font-semibold mt-6 mb-3">A. Information you provide to us</h3>
          <ul className="list-disc pl-6 space-y-2 text-gray-300">
            <li><strong>Account information:</strong> email address, name (if provided), authentication details (e.g., magic link login metadata).</li>
            <li><strong>Billing information:</strong> billing name, billing address, payment method details (processed by Stripe; we do not store full card numbers).</li>
            <li><strong>Support communications:</strong> messages you send us (e.g., emails, chat, bug reports), and any information you include.</li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-3">B. Content you upload or generate</h3>
          <ul className="list-disc pl-6 space-y-2 text-gray-300">
            <li>Uploaded videos and associated files you submit for watermark removal (&quot;User Content&quot;).</li>
            <li>Output files produced by the Service (e.g., processed video).</li>
            <li>Job metadata: file type, file size, processing mode (e.g., Crop or Inpaint), timestamps, processing status, and error logs related to processing.</li>
          </ul>

          <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-4 my-4">
            <p className="text-yellow-200 text-sm">
              <strong>Important:</strong> Videos may contain personal data (e.g., faces, voices, location data in the content). Only upload content you have the rights to use.
            </p>
          </div>

          <h3 className="text-xl font-semibold mt-6 mb-3">C. Information we collect automatically</h3>
          <ul className="list-disc pl-6 space-y-2 text-gray-300">
            <li><strong>Device and usage data:</strong> IP address, browser type, device identifiers, operating system, referral URLs, pages viewed, clicks, and session activity.</li>
            <li><strong>Cookies and similar technologies:</strong> used for authentication, security, preferences, and analytics (see Section 7).</li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-3">D. Analytics / product telemetry</h3>
          <p className="text-gray-300">We may collect event data such as:</p>
          <ul className="list-disc pl-6 space-y-2 text-gray-300">
            <li>Page views, signups, logins</li>
            <li>Upload started/completed</li>
            <li>Job started/completed/failed</li>
            <li>Credit usage, plan selection</li>
            <li>Checkout initiated and purchase completed</li>
            <li>Feature engagement (e.g., selecting Crop vs Inpaint)</li>
          </ul>

          <hr className="border-gray-700 my-8" />

          <h2 className="text-2xl font-bold mt-8 mb-4">2) How We Use Information</h2>
          <p className="text-gray-300">We use information to:</p>

          <h3 className="text-xl font-semibold mt-6 mb-3">1. Provide and operate the Service</h3>
          <ul className="list-disc pl-6 space-y-2 text-gray-300">
            <li>Create and manage your account</li>
            <li>Process uploaded videos and generate outputs</li>
            <li>Show job status and deliver download links</li>
            <li>Manage credits and subscription entitlements</li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-3">2. Improve reliability and performance</h3>
          <ul className="list-disc pl-6 space-y-2 text-gray-300">
            <li>Monitor uptime and job success rates</li>
            <li>Debug failures and prevent silent errors</li>
            <li>Optimize processing speed and quality</li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-3">3. Payments and billing</h3>
          <ul className="list-disc pl-6 space-y-2 text-gray-300">
            <li>Process subscriptions and credit purchases</li>
            <li>Prevent fraudulent transactions</li>
            <li>Handle refunds/credit reversals when jobs fail</li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-3">4. Communicate with you</h3>
          <ul className="list-disc pl-6 space-y-2 text-gray-300">
            <li>Send operational messages (e.g., processing complete, receipts, account notices)</li>
            <li>Respond to support requests</li>
            <li>Send important product or policy updates</li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-3">5. Security and compliance</h3>
          <ul className="list-disc pl-6 space-y-2 text-gray-300">
            <li>Detect fraud, abuse, and prohibited use</li>
            <li>Enforce terms and protect users and our systems</li>
            <li>Comply with legal obligations</li>
          </ul>

          <hr className="border-gray-700 my-8" />

          <h2 className="text-2xl font-bold mt-8 mb-4">3) Legal Bases for Processing</h2>
          <p className="text-gray-300">Depending on your location, we rely on one or more of the following legal bases:</p>
          <ul className="list-disc pl-6 space-y-2 text-gray-300">
            <li><strong>Contract:</strong> to provide the Service you request (e.g., processing your videos, managing credits).</li>
            <li><strong>Legitimate interests:</strong> to secure and improve the Service, prevent fraud, and analyze product usage.</li>
            <li><strong>Consent:</strong> for certain cookies/analytics or marketing communications where required.</li>
            <li><strong>Legal obligation:</strong> to comply with applicable laws, tax rules, and lawful requests.</li>
          </ul>

          <hr className="border-gray-700 my-8" />

          <h2 className="text-2xl font-bold mt-8 mb-4">4) How We Share Information</h2>
          
          <div className="bg-green-900/20 border border-green-600/30 rounded-lg p-4 my-4">
            <p className="text-green-200 font-semibold">We do not sell your personal information.</p>
          </div>

          <p className="text-gray-300">We may share information with:</p>

          <h3 className="text-xl font-semibold mt-6 mb-3">A. Service providers (&quot;processors&quot;)</h3>
          <p className="text-gray-300">We use trusted third parties to operate the Service:</p>
          <ul className="list-disc pl-6 space-y-2 text-gray-300">
            <li><strong>Hosting / infrastructure:</strong> Vercel, Render, Supabase</li>
            <li><strong>Database / authentication:</strong> Supabase</li>
            <li><strong>Payment processors:</strong> Stripe</li>
            <li><strong>Email delivery:</strong> Resend</li>
            <li><strong>Analytics providers:</strong> PostHog, Meta Pixel</li>
            <li><strong>Error monitoring:</strong> Application logging services</li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-3">B. Business transfers</h3>
          <p className="text-gray-300">If we are involved in a merger, acquisition, financing, reorganization, or sale of assets, information may be transferred as part of that transaction.</p>

          <h3 className="text-xl font-semibold mt-6 mb-3">C. Legal and safety</h3>
          <p className="text-gray-300">We may disclose information if we believe it is necessary to:</p>
          <ul className="list-disc pl-6 space-y-2 text-gray-300">
            <li>Comply with law or legal process</li>
            <li>Protect rights, safety, and security of users, BlankLogo, or the public</li>
            <li>Investigate fraud, abuse, or security incidents</li>
          </ul>

          <hr className="border-gray-700 my-8" />

          <h2 className="text-2xl font-bold mt-8 mb-4">5) Video Content: Processing, Storage, and Retention</h2>

          <h3 className="text-xl font-semibold mt-6 mb-3">A. Processing modes</h3>
          <p className="text-gray-300">BlankLogo offers:</p>
          <ul className="list-disc pl-6 space-y-2 text-gray-300">
            <li><strong>Crop Mode:</strong> removes watermarks by trimming edges (fast).</li>
            <li><strong>Inpaint Mode:</strong> uses AI-based filling to remove watermark regions.</li>
          </ul>
          <p className="text-gray-300 mt-2">Inpaint Mode uses specialized GPU compute providers. Content is processed only to produce your requested output.</p>

          <h3 className="text-xl font-semibold mt-6 mb-3">B. Retention</h3>
          <ul className="list-disc pl-6 space-y-2 text-gray-300">
            <li>Uploaded videos and generated outputs are stored temporarily to provide the Service and allow download.</li>
            <li><strong>Default retention:</strong> Videos and outputs are automatically deleted after <strong>7 days</strong>.</li>
            <li>Paid plans may extend download link availability (e.g., 30 or 90 days).</li>
            <li>Job logs/metadata (non-video) may be retained longer for security, analytics, billing, and reliability.</li>
          </ul>
          <p className="text-gray-300 mt-2">You can request earlier deletion by contacting us (see Section 10).</p>

          <h3 className="text-xl font-semibold mt-6 mb-3">C. Access controls</h3>
          <p className="text-gray-300">We limit internal access to User Content and apply access controls designed to prevent unauthorized access.</p>

          <hr className="border-gray-700 my-8" />

          <h2 className="text-2xl font-bold mt-8 mb-4">6) Data Security</h2>
          <p className="text-gray-300">We use reasonable administrative, technical, and physical safeguards designed to protect information, such as:</p>
          <ul className="list-disc pl-6 space-y-2 text-gray-300">
            <li>Encrypted connections (HTTPS)</li>
            <li>Access controls and least-privilege permissions</li>
            <li>Monitoring for abuse and anomalous activity</li>
            <li>Secure payment handling through Stripe</li>
          </ul>
          <p className="text-gray-400 mt-4 text-sm">No method of transmission or storage is 100% secure. You are responsible for safeguarding your account credentials.</p>

          <hr className="border-gray-700 my-8" />

          <h2 className="text-2xl font-bold mt-8 mb-4">7) Cookies and Tracking Technologies</h2>
          <p className="text-gray-300">We use cookies and similar technologies for:</p>
          <ul className="list-disc pl-6 space-y-2 text-gray-300">
            <li><strong>Essential functions:</strong> authentication, session management, security</li>
            <li><strong>Preferences:</strong> remembering settings</li>
            <li><strong>Analytics:</strong> understanding how users interact with the Service (PostHog, Meta Pixel)</li>
          </ul>
          <p className="text-gray-300 mt-2">Where required by law, we provide cookie consent controls.</p>

          <hr className="border-gray-700 my-8" />

          <h2 className="text-2xl font-bold mt-8 mb-4">8) International Data Transfers</h2>
          <p className="text-gray-300">If you access the Service from outside the United States, your information may be processed in other countries. Where required, we use appropriate safeguards for cross-border transfers (e.g., contractual protections).</p>

          <hr className="border-gray-700 my-8" />

          <h2 className="text-2xl font-bold mt-8 mb-4">9) Children&apos;s Privacy</h2>
          <p className="text-gray-300">The Service is not intended for children under 13 (or under 16 in certain jurisdictions). We do not knowingly collect personal information from children. If you believe a child provided us information, contact us to request deletion.</p>

          <hr className="border-gray-700 my-8" />

          <h2 className="text-2xl font-bold mt-8 mb-4">10) Your Rights and Choices</h2>
          <p className="text-gray-300">Depending on where you live, you may have rights to:</p>
          <ul className="list-disc pl-6 space-y-2 text-gray-300">
            <li><strong>Access</strong> the personal information we have about you</li>
            <li><strong>Correct</strong> inaccurate information</li>
            <li><strong>Delete</strong> your information (subject to legal/operational requirements)</li>
            <li><strong>Portability</strong> (receive a copy in a usable format)</li>
            <li><strong>Object / Restrict</strong> certain processing</li>
            <li><strong>Withdraw consent</strong> where processing is based on consent</li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-3">How to exercise rights</h3>
          <p className="text-gray-300">
            Email us at: <a href="mailto:privacy@blanklogo.app" className="text-indigo-400 hover:text-indigo-300">privacy@blanklogo.app</a><br />
            Include: your account email, the request type, and any relevant details.
          </p>
          <p className="text-gray-400 text-sm mt-2">We may need to verify your identity before fulfilling requests.</p>

          <hr className="border-gray-700 my-8" />

          <h2 className="text-2xl font-bold mt-8 mb-4">11) California Privacy Notice (CCPA/CPRA)</h2>
          <p className="text-gray-300">If you are a California resident, you may have additional rights including:</p>
          <ul className="list-disc pl-6 space-y-2 text-gray-300">
            <li>Right to know what personal information we collect, use, and disclose</li>
            <li>Right to delete (with exceptions)</li>
            <li>Right to correct</li>
            <li>Right to opt out of &quot;sale&quot; or &quot;sharing&quot; (we do not sell personal information)</li>
          </ul>
          <p className="text-gray-300 mt-4">To submit a request, contact: <a href="mailto:privacy@blanklogo.app" className="text-indigo-400 hover:text-indigo-300">privacy@blanklogo.app</a></p>

          <hr className="border-gray-700 my-8" />

          <h2 className="text-2xl font-bold mt-8 mb-4">12) EU/UK Notice (GDPR)</h2>
          <p className="text-gray-300">If you are in the EU/UK:</p>
          <ul className="list-disc pl-6 space-y-2 text-gray-300">
            <li>BlankLogo acts as <strong>Controller</strong> for account, billing, and analytics data.</li>
            <li>BlankLogo may act as <strong>Processor</strong> for video content you upload, depending on how you use the Service.</li>
          </ul>
          <p className="text-gray-300 mt-2">You may lodge a complaint with your local data protection authority.</p>

          <hr className="border-gray-700 my-8" />

          <h2 className="text-2xl font-bold mt-8 mb-4">13) Third-Party Links</h2>
          <p className="text-gray-300">The Service may link to third-party sites (e.g., Stripe payment portal). We are not responsible for their privacy practices.</p>

          <hr className="border-gray-700 my-8" />

          <h2 className="text-2xl font-bold mt-8 mb-4">14) Changes to This Policy</h2>
          <p className="text-gray-300">We may update this Privacy Policy from time to time. If changes are material, we will provide notice (e.g., on the site or by email). The &quot;Last Updated&quot; date reflects the latest version.</p>

          <hr className="border-gray-700 my-8" />

          <h2 className="text-2xl font-bold mt-8 mb-4">15) Contact Us</h2>
          <div className="bg-gray-800/50 rounded-lg p-6 mt-4">
            <p className="text-white font-semibold text-lg mb-4">BlankLogo</p>
            <p className="text-gray-300">
              Email: <a href="mailto:privacy@blanklogo.app" className="text-indigo-400 hover:text-indigo-300">privacy@blanklogo.app</a><br />
              Support: <a href="mailto:support@blanklogo.app" className="text-indigo-400 hover:text-indigo-300">support@blanklogo.app</a>
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
