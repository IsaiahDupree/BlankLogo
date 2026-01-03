import Link from "next/link";
import { Home, Video, History, Coins, Settings, CreditCard, LogOut, Sparkles, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

async function getCredits(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_credit_balance", { p_user_id: userId });
  return data ?? 0;
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();
  
  if (!user) {
    redirect("/login");
  }

  const credits = await getCredits(user.id);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 border-r border-white/10 flex flex-col">
        <div className="p-6">
          <Link href="/app" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <span className="text-xl font-bold">B</span>
            </div>
            <span className="text-xl font-bold">BlankLogo</span>
          </Link>
        </div>

        <nav className="flex-1 px-4">
          <ul className="space-y-1">
            <li>
              <Link
                href="/app"
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-gray-300 hover:text-white transition"
              >
                <Home className="w-5 h-5" />
                Dashboard
              </Link>
            </li>
            <li>
              <Link
                href="/app/remove"
                className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-white hover:from-indigo-500/30 hover:to-purple-500/30 transition"
              >
                <Sparkles className="w-5 h-5 text-indigo-400" />
                Remove Watermark
              </Link>
            </li>
            <li>
              <Link
                href="/app/jobs"
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-gray-300 hover:text-white transition"
              >
                <Video className="w-5 h-5" />
                My Jobs
              </Link>
            </li>
            <li>
              <Link
                href="/app/history"
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-gray-300 hover:text-white transition"
              >
                <History className="w-5 h-5" />
                History
              </Link>
            </li>
            <li>
              <Link
                href="/app/credits"
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-gray-300 hover:text-white transition"
              >
                <Coins className="w-5 h-5" />
                Buy Credits
              </Link>
            </li>
            <li>
              <Link
                href="/app/settings"
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-gray-300 hover:text-white transition"
              >
                <Settings className="w-5 h-5" />
                Settings
              </Link>
            </li>
          </ul>
        </nav>

        <div className="p-4 border-t border-white/10">
          <Link href="/app/credits" className="block p-3 rounded-lg bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 mb-4 hover:from-indigo-500/20 hover:to-purple-500/20 transition">
            <div className="flex items-center gap-2 text-indigo-400 text-sm font-medium mb-1">
              <Zap className="w-4 h-4" />
              Credits Available
            </div>
            <div className="text-2xl font-bold">{credits}</div>
          </Link>
          
          <div className="text-sm text-gray-400 mb-2 truncate">
            {user.email}
          </div>
          
          <form action="/auth/signout" method="POST">
            <button
              type="submit"
              className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
