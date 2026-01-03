"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, Mail, Loader2, CheckCircle } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import { useToast } from "@/components/toast";

// Logging utility
function logSettings(message: string, data?: unknown) {
  console.log(`[PAGE: SETTINGS] ${message}`, data !== undefined ? data : "");
}

type NotificationPrefs = {
  email_job_started: boolean;
  email_job_completed: boolean;
  email_job_failed: boolean;
  email_credits_low: boolean;
  email_account_status: boolean;
  marketing_opt_in: boolean;
};

const defaultPrefs: NotificationPrefs = {
  email_job_started: false,
  email_job_completed: true,
  email_job_failed: true,
  email_credits_low: true,
  email_account_status: true,
  marketing_opt_in: false,
};

export default function SettingsPage() {
  const [prefs, setPrefs] = useState<NotificationPrefs>(defaultPrefs);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const toast = useToast();

  useEffect(() => {
    logSettings("⚙️ Settings page loaded");
  }, []);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const fetchPrefs = useCallback(async () => {
    logSettings("🔍 Fetching preferences...");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        logSettings("❌ No user found");
        return;
      }
      logSettings("👤 User:", user.id);

      const { data } = await supabase
        .from("user_notification_prefs")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) {
        logSettings("✅ Preferences loaded:", data);
        setPrefs({
          email_job_started: data.email_job_started,
          email_job_completed: data.email_job_completed,
          email_job_failed: data.email_job_failed,
          email_credits_low: data.email_credits_low,
          email_account_status: data.email_account_status,
          marketing_opt_in: data.marketing_opt_in,
        });
      } else {
        logSettings("ℹ️ Using default preferences");
      }
    } catch (err) {
      logSettings("❌ Failed to load preferences:", err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchPrefs();
  }, [fetchPrefs]);

  async function handleSave() {
    logSettings("💾 Saving preferences...", prefs);
    setSaving(true);
    setSaved(false);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        logSettings("❌ No user found");
        return;
      }

      const { error } = await supabase
        .from("user_notification_prefs")
        .upsert({
          user_id: user.id,
          ...prefs,
          updated_at: new Date().toISOString(),
        });

      if (error) {
        logSettings("❌ Save failed:", error);
        throw error;
      }

      logSettings("✅ Preferences saved successfully");
      setSaved(true);
      toast.success("Preferences saved successfully!");
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      logSettings("❌ Failed to save preferences:", err);
      toast.error("Failed to save preferences. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function togglePref(key: keyof NotificationPrefs) {
    logSettings("🔄 Toggling preference:", key);
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Settings</h1>
        <p className="text-gray-400">Manage your notification preferences</p>
      </div>

      {/* Email Notifications */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Email Notifications
        </h2>

        <div className="space-y-4">
          <ToggleItem
            label="Job Started"
            description="Get notified when your video starts generating"
            checked={prefs.email_job_started}
            onChange={() => togglePref("email_job_started")}
          />
          <ToggleItem
            label="Job Completed"
            description="Get notified when your video is ready to download"
            checked={prefs.email_job_completed}
            onChange={() => togglePref("email_job_completed")}
          />
          <ToggleItem
            label="Job Failed"
            description="Get notified if something goes wrong during generation"
            checked={prefs.email_job_failed}
            onChange={() => togglePref("email_job_failed")}
          />
          <ToggleItem
            label="Credits Low"
            description="Get notified when your credits are running low"
            checked={prefs.email_credits_low}
            onChange={() => togglePref("email_credits_low")}
          />
          <ToggleItem
            label="Account Updates"
            description="Important updates about your account"
            checked={prefs.email_account_status}
            onChange={() => togglePref("email_account_status")}
          />
        </div>
      </div>

      {/* Marketing */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Mail className="w-5 h-5" />
          Marketing & Updates
        </h2>

        <ToggleItem
          label="Product Updates & Promotions"
          description="New features, template packs, and special offers"
          checked={prefs.marketing_opt_in}
          onChange={() => togglePref("marketing_opt_in")}
        />
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50 transition font-semibold flex items-center justify-center gap-2"
      >
        {saving ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Saving...
          </>
        ) : saved ? (
          <>
            <CheckCircle className="w-5 h-5" />
            Saved!
          </>
        ) : (
          "Save Preferences"
        )}
      </button>
    </div>
  );
}

function ToggleItem({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <div className="font-medium">{label}</div>
        <div className="text-sm text-gray-400">{description}</div>
      </div>
      <button
        onClick={onChange}
        className={`relative w-12 h-6 rounded-full transition ${
          checked ? "bg-brand-500" : "bg-gray-600"
        }`}
      >
        <span
          className={`absolute top-1 w-4 h-4 rounded-full bg-white transition ${
            checked ? "left-7" : "left-1"
          }`}
        />
      </button>
    </div>
  );
}
