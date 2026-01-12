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
          Effective Date: January 11, 2026 | Last Updated: January 11, 2026
        </p>

        <div className="prose prose-invert prose-lg max-w-none space-y-8">
          <p className="lead text-xl text-gray-300">
            These Terms of Service (&quot;Terms&quot;) govern your access to and use of blanklogo.app and the watermark removal tools and services provided by Dupree Ops LLC (&quot;Company,&quot; &quot;BlankLogo,&quot; &quot;we,&quot; &quot;us,&quot; &quot;our&quot;) (the &quot;Service&quot;).
          </p>
          <p className="text-gray-400">
            By using the Service, you agree to these Terms. If you do not agree, do not use the Service.
          </p>

          <hr className="border-gray-700" />

          <section>
            <h2 className="text-2xl font-bold mb-4">1) Who We Are / Contact</h2>
            <div className="bg-gray-800/50 rounded-lg p-6">
              <p className="text-white font-semibold text-lg mb-2">Dupree Ops LLC</p>
              <p className="text-gray-300">
                3425 Delaney Drive, Florida, United States<br /><br />
                <strong>Support:</strong> <a href="mailto:support@blanklogo.app" className="text-indigo-400 hover:text-indigo-300">support@blanklogo.app</a><br />
                <strong>Privacy:</strong> <a href="mailto:privacy@blanklogo.app" className="text-indigo-400 hover:text-indigo-300">privacy@blanklogo.app</a>
              </p>
            </div>
          </section>

          <hr className="border-gray-700" />

          <section>
            <h2 className="text-2xl font-bold mb-4">2) Eligibility and Accounts</h2>
            <p className="text-gray-300 mb-3">You must be at least 13 years old (or 16 where required by law) and able to form a binding contract.</p>
            <p className="text-gray-300 mb-2">You are responsible for:</p>
            <ul className="list-disc pl-6 space-y-1 text-gray-300">
              <li>Maintaining the confidentiality of your login credentials</li>
              <li>All activity under your account</li>
              <li>Providing accurate account information</li>
            </ul>
            <p className="text-gray-400 text-sm mt-3">We may suspend or terminate accounts that violate these Terms.</p>
          </section>

          <hr className="border-gray-700" />

          <section>
            <h2 className="text-2xl font-bold mb-4">3) The Service</h2>
            <p className="text-gray-300 mb-3">BlankLogo helps users remove watermarks from videos using one or more methods (for example, crop-based removal and/or AI-based inpainting). You may upload videos or submit URLs, choose processing options (if available), and download outputs.</p>
            <p className="text-gray-400">We may modify or discontinue any part of the Service at any time.</p>
          </section>

          <hr className="border-gray-700" />

          <section>
            <h2 className="text-2xl font-bold mb-4">4) Credits, Plans, Billing, and Rollover</h2>

            <h3 className="text-xl font-semibold mt-4 mb-3">A) Credits</h3>
            <p className="text-gray-300 mb-2">Unless otherwise stated:</p>
            <ul className="list-disc pl-6 space-y-1 text-gray-300">
              <li>1 credit = 1 video processed (one processing job).</li>
              <li>Credits are required to process videos.</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">B) Free credits</h3>
            <p className="text-gray-300 mb-2">New accounts may receive 10 free credits (one-time). Free credits:</p>
            <ul className="list-disc pl-6 space-y-1 text-gray-300">
              <li>are limited to one allocation per account</li>
              <li>have no cash value</li>
              <li>may be withheld or revoked in cases of suspected abuse, fraud, or policy violations</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">C) Monthly plans and rollover</h3>
            <p className="text-gray-300 mb-2">If you subscribe to a monthly plan:</p>
            <ul className="list-disc pl-6 space-y-1 text-gray-300">
              <li>Credits are added each billing cycle according to the plan.</li>
              <li><strong>Credits roll over</strong> while your subscription remains active, subject to fair use and abuse prevention.</li>
              <li>Plan features may include extended download availability, priority processing, webhooks, API access, and/or batch processing (as displayed at checkout).</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">D) Top-up packs</h3>
            <p className="text-gray-300 mb-2">Top-up credits are one-time purchases. Unless stated otherwise at checkout:</p>
            <ul className="list-disc pl-6 space-y-1 text-gray-300">
              <li>top-up credits <strong>do not expire</strong></li>
              <li>top-up credits are non-refundable except as required by law or as stated in Section 10</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">E) Payment processing</h3>
            <p className="text-gray-300">Payments are processed by third-party payment processors. You authorize us (and our processors) to charge your payment method for subscriptions and/or credit purchases.</p>

            <h3 className="text-xl font-semibold mt-6 mb-3">F) Taxes</h3>
            <p className="text-gray-300">You are responsible for applicable taxes, duties, and fees associated with your purchases.</p>
          </section>

          <hr className="border-gray-700" />

          <section>
            <h2 className="text-2xl font-bold mb-4">5) Uploads, Rights, and Acceptable Use</h2>

            <h3 className="text-xl font-semibold mt-4 mb-3">A) Your responsibility and rights</h3>
            <p className="text-gray-300 mb-3">You may only upload or submit content that you own or have permission to use and process.</p>
            
            <p className="text-gray-300 mb-2">You agree not to use the Service to:</p>
            <ul className="list-disc pl-6 space-y-1 text-gray-300">
              <li>Remove watermarks from content you do not have rights to modify or redistribute</li>
              <li>Infringe intellectual property rights</li>
              <li>Violate laws or third-party rights</li>
              <li>Distribute malware or attempt to compromise the Service</li>
              <li>Abuse, scrape, reverse engineer, or circumvent rate limits or access controls</li>
            </ul>

            <div className="bg-red-900/20 border border-red-600/30 rounded-lg p-4 mt-4">
              <p className="text-red-200 text-sm">
                <strong>Warning:</strong> We may suspend, restrict, or terminate accounts for suspected violations.
              </p>
            </div>
          </section>

          <hr className="border-gray-700" />

          <section>
            <h2 className="text-2xl font-bold mb-4">6) Processing, Output Quality, and Limitations</h2>

            <h3 className="text-xl font-semibold mt-4 mb-3">A) Output variability</h3>
            <p className="text-gray-300">Results can vary depending on watermark placement, video resolution/compression, motion, and selected processing method. We do not guarantee perfect results for every video.</p>

            <h3 className="text-xl font-semibold mt-6 mb-3">B) Processing times</h3>
            <p className="text-gray-300">Processing times vary by file size, queue load, and mode selected. We may show typical processing times, but they are not guaranteed.</p>

            <h3 className="text-xl font-semibold mt-6 mb-3">C) File limits and supported formats</h3>
            <p className="text-gray-300">Supported formats and file size limits may change. Jobs that exceed limits may fail or be rejected.</p>

            <h3 className="text-xl font-semibold mt-6 mb-3">D) Download links and retention</h3>
            <p className="text-gray-300">We provide download links for convenience. <strong>Videos and outputs are automatically deleted after 90 days.</strong> You are responsible for downloading and backing up your outputs before deletion.</p>
          </section>

          <hr className="border-gray-700" />

          <section>
            <h2 className="text-2xl font-bold mb-4">7) Your Content and Our License to Operate the Service</h2>

            <h3 className="text-xl font-semibold mt-4 mb-3">A) Your content</h3>
            <p className="text-gray-300">You retain ownership of your uploaded content.</p>

            <h3 className="text-xl font-semibold mt-6 mb-3">B) Limited license</h3>
            <p className="text-gray-300 mb-2">To operate the Service, you grant us a limited, non-exclusive, worldwide license to host, process, transmit, and display your content solely to:</p>
            <ul className="list-disc pl-6 space-y-1 text-gray-300">
              <li>process jobs you request and generate outputs</li>
              <li>provide downloads and notifications</li>
              <li>maintain security, prevent abuse, and troubleshoot failures</li>
              <li>improve reliability and service performance (e.g., debugging and quality improvements)</li>
            </ul>
            <p className="text-gray-400 text-sm mt-2">We do not claim ownership of your content.</p>

            <h3 className="text-xl font-semibold mt-6 mb-3">C) Feedback</h3>
            <p className="text-gray-300">If you submit feedback or suggestions, you grant us the right to use them without compensation.</p>
          </section>

          <hr className="border-gray-700" />

          <section>
            <h2 className="text-2xl font-bold mb-4">8) Privacy and Retargeting</h2>
            <p className="text-gray-300">Your use of the Service is subject to our <Link href="/privacy" className="text-indigo-400 hover:text-indigo-300">Privacy Policy</Link>. We use analytics and retargeting (e.g., pixels) for measurement and advertising. You can control certain tracking via browser settings and, where applicable, consent tools.</p>
          </section>

          <hr className="border-gray-700" />

          <section>
            <h2 className="text-2xl font-bold mb-4">9) Account Deletion</h2>
            <p className="text-gray-300 mb-2">We offer <strong>complete account deletion from within the app</strong>. When you delete your account, we will remove or de-identify your account data where feasible, subject to:</p>
            <ul className="list-disc pl-6 space-y-1 text-gray-300">
              <li>legal/tax/accounting retention requirements</li>
              <li>fraud prevention and dispute resolution needs</li>
              <li>technical constraints for deletion workflows</li>
            </ul>
          </section>

          <hr className="border-gray-700" />

          <section>
            <h2 className="text-2xl font-bold mb-4">10) Failed Jobs, Credits, Refunds, and Chargebacks</h2>

            <h3 className="text-xl font-semibold mt-4 mb-3">A) Failed jobs / credit returns</h3>
            <p className="text-gray-300">If a job fails and cannot be recovered, we may return the credit to your account automatically.</p>

            <h3 className="text-xl font-semibold mt-6 mb-3">B) Refunds</h3>
            <p className="text-gray-300 mb-2">Except where required by law:</p>
            <ul className="list-disc pl-6 space-y-1 text-gray-300">
              <li>Subscription fees are generally non-refundable once billed.</li>
              <li>Top-up credits are generally non-refundable.</li>
              <li>Credits have no cash value and cannot be exchanged for cash.</li>
            </ul>
            <p className="text-gray-300 mt-2">If you believe a charge is incorrect, contact <a href="mailto:support@blanklogo.app" className="text-indigo-400 hover:text-indigo-300">support@blanklogo.app</a> promptly.</p>

            <h3 className="text-xl font-semibold mt-6 mb-3">C) Chargebacks</h3>
            <p className="text-gray-300">Chargebacks without contacting support first may result in account suspension. We reserve the right to dispute chargebacks and provide evidence of Service usage and delivery.</p>
          </section>

          <hr className="border-gray-700" />

          <section>
            <h2 className="text-2xl font-bold mb-4">11) Suspension and Termination</h2>
            <p className="text-gray-300 mb-2">We may suspend or terminate access if:</p>
            <ul className="list-disc pl-6 space-y-1 text-gray-300">
              <li>You violate these Terms</li>
              <li>We suspect fraud, abuse, or security threats</li>
              <li>Required by law</li>
            </ul>
            <p className="text-gray-300 mt-3">You may stop using the Service at any time. Subscription cancellation takes effect according to the billing terms shown at checkout (typically at the end of the billing period).</p>
          </section>

          <hr className="border-gray-700" />

          <section>
            <h2 className="text-2xl font-bold mb-4">12) Disclaimers</h2>
            <div className="bg-gray-800/50 rounded-lg p-4">
              <p className="text-gray-300 uppercase text-sm">
                THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE.&quot; TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
              </p>
            </div>
            <p className="text-gray-300 mt-3">We do not guarantee uninterrupted or error-free operation or that outputs will meet your exact expectations.</p>
          </section>

          <hr className="border-gray-700" />

          <section>
            <h2 className="text-2xl font-bold mb-4">13) Limitation of Liability</h2>
            <div className="bg-gray-800/50 rounded-lg p-4">
              <p className="text-gray-300 uppercase text-sm mb-3">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, BLANKLOGO AND DUPREE OPS LLC WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, DATA, OR GOODWILL.
              </p>
              <p className="text-gray-300 text-sm">
                OUR TOTAL LIABILITY FOR ALL CLAIMS WILL NOT EXCEED THE GREATER OF: THE AMOUNT YOU PAID US IN THE 3 MONTHS BEFORE THE EVENT GIVING RISE TO THE CLAIM, OR $100 USD.
              </p>
            </div>
            <p className="text-gray-400 text-sm mt-3">Some jurisdictions do not allow certain limitations, so some may not apply.</p>
          </section>

          <hr className="border-gray-700" />

          <section>
            <h2 className="text-2xl font-bold mb-4">14) Indemnification</h2>
            <p className="text-gray-300 mb-2">You agree to indemnify and hold harmless Dupree Ops LLC from claims, liabilities, damages, and expenses arising from:</p>
            <ul className="list-disc pl-6 space-y-1 text-gray-300">
              <li>Your use of the Service</li>
              <li>Your uploaded content</li>
              <li>Your violation of these Terms</li>
              <li>Your violation of any rights of a third party</li>
            </ul>
          </section>

          <hr className="border-gray-700" />

          <section>
            <h2 className="text-2xl font-bold mb-4">15) DMCA / Copyright Complaints</h2>
            <p className="text-gray-300 mb-2">If you believe your copyrighted work was infringed, send a notice to <a href="mailto:dmca@blanklogo.app" className="text-indigo-400 hover:text-indigo-300">dmca@blanklogo.app</a> including:</p>
            <ul className="list-disc pl-6 space-y-1 text-gray-300">
              <li>identification of the copyrighted work</li>
              <li>identification of the allegedly infringing material</li>
              <li>your contact information</li>
              <li>a good-faith statement</li>
              <li>a statement under penalty of perjury that the information is accurate</li>
              <li>your signature (physical or electronic)</li>
            </ul>
            <p className="text-gray-400 text-sm mt-3">We may suspend repeat infringers and remove access where appropriate.</p>
          </section>

          <hr className="border-gray-700" />

          <section>
            <h2 className="text-2xl font-bold mb-4">16) Governing Law and Venue</h2>
            <p className="text-gray-300 mb-3">These Terms are governed by the laws of the <strong>State of Florida</strong>, without regard to conflict-of-law rules.</p>
            <p className="text-gray-300 mb-3">You agree that any dispute will be brought in the state or federal courts located in Florida, and you consent to their jurisdiction, except where prohibited by applicable law.</p>
            <p className="text-gray-300">Before filing a claim, you agree to contact us at <a href="mailto:support@blanklogo.app" className="text-indigo-400 hover:text-indigo-300">support@blanklogo.app</a> and attempt to resolve the issue informally.</p>
          </section>

          <hr className="border-gray-700" />

          <section>
            <h2 className="text-2xl font-bold mb-4">17) Changes to These Terms</h2>
            <p className="text-gray-300">We may update these Terms. The &quot;Last Updated&quot; date reflects the current version. Continued use after updates constitutes acceptance.</p>
          </section>

          <hr className="border-gray-700" />

          <section>
            <h2 className="text-2xl font-bold mb-4">18) Contact</h2>
            <div className="bg-gray-800/50 rounded-lg p-6">
              <p className="text-white font-semibold text-lg mb-2">Dupree Ops LLC</p>
              <p className="text-gray-300">
                3425 Delaney Drive, Florida, United States<br /><br />
                <strong>Support:</strong> <a href="mailto:support@blanklogo.app" className="text-indigo-400 hover:text-indigo-300">support@blanklogo.app</a><br />
                <strong>Privacy:</strong> <a href="mailto:privacy@blanklogo.app" className="text-indigo-400 hover:text-indigo-300">privacy@blanklogo.app</a>
              </p>
            </div>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-800">
          <div className="flex flex-wrap gap-4 text-sm text-gray-400">
            <Link href="/terms" className="hover:text-white transition">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-white transition">Privacy Policy</Link>
            <Link href="/subprocessors" className="hover:text-white transition">Subprocessors</Link>
            <Link href="/" className="hover:text-white transition">Home</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
