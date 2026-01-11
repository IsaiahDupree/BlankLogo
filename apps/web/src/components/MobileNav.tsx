"use client";

import { useState } from "react";
import Link from "next/link";
import { Home, Video, History, Coins, Settings, LogOut, Sparkles, Menu, X } from "lucide-react";

interface MobileNavProps {
  userEmail: string;
  credits: number;
}

export function MobileNav({ userEmail, credits }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);

  const navItems = [
    { href: "/app", icon: Home, label: "Dashboard" },
    { href: "/app/remove", icon: Sparkles, label: "Remove Watermark", highlight: true },
    { href: "/app/jobs", icon: Video, label: "My Jobs" },
    { href: "/app/history", icon: History, label: "History" },
    { href: "/app/credits", icon: Coins, label: "Buy Credits" },
    { href: "/app/settings", icon: Settings, label: "Settings" },
  ];

  return (
    <>
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-gray-900 border-b border-white/10 px-4 py-3">
        <div className="flex items-center justify-between">
          <Link href="/app" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <span className="text-lg font-bold">B</span>
            </div>
            <span className="text-lg font-bold">BlankLogo</span>
          </Link>
          
          <div className="flex items-center gap-3">
            <div className="px-2 py-1 rounded-lg bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30">
              <span className="text-sm font-medium text-amber-400">{credits} credits</span>
            </div>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 rounded-lg hover:bg-white/10 transition"
              aria-label="Toggle menu"
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {isOpen && (
        <div 
          className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Mobile Menu */}
      <nav 
        className={`lg:hidden fixed top-[57px] right-0 bottom-0 z-40 w-72 bg-gray-900 border-l border-white/10 transform transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="flex-1 py-4 px-3 overflow-y-auto">
            <ul className="space-y-1">
              {navItems.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                      item.highlight
                        ? "bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-white hover:from-indigo-500/30 hover:to-purple-500/30"
                        : "text-gray-300 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <item.icon className={`w-5 h-5 ${item.highlight ? "text-indigo-400" : ""}`} />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="p-4 border-t border-white/10">
            <div className="text-sm text-gray-400 mb-3 truncate">
              {userEmail}
            </div>
            <form action="/auth/signout" method="POST">
              <button
                type="submit"
                className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition w-full px-4 py-2 rounded-lg hover:bg-white/5"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </form>
          </div>
        </div>
      </nav>
    </>
  );
}
