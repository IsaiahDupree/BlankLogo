"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { 
  Key, 
  Plus, 
  Copy, 
  Trash2, 
  Eye, 
  EyeOff, 
  Loader2,
  CheckCircle,
  AlertCircle
} from "lucide-react";

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  created_at: string;
  expires_at: string | null;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    fetchKeys();
  }, []);

  const fetchKeys = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from("api_keys")
        .select("id, name, key_prefix, last_used_at, created_at, expires_at")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setKeys(data || []);
    } catch (err) {
      console.error("[ApiKeys] Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const createKey = async () => {
    if (!newKeyName.trim()) {
      setError("Please enter a name for your API key");
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // Generate a secure API key
      const keyBytes = new Uint8Array(32);
      crypto.getRandomValues(keyBytes);
      const fullKey = `bl_${Array.from(keyBytes).map(b => b.toString(16).padStart(2, '0')).join('')}`;
      const keyPrefix = fullKey.slice(0, 12) + "...";

      // Hash the key for storage
      const encoder = new TextEncoder();
      const data = encoder.encode(fullKey);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const keyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      const { error: insertError } = await supabase
        .from("api_keys")
        .insert({
          user_id: session.user.id,
          name: newKeyName.trim(),
          key_hash: keyHash,
          key_prefix: keyPrefix,
        });

      if (insertError) throw insertError;

      setNewKey(fullKey);
      setNewKeyName("");
      fetchKeys();
    } catch (err) {
      console.error("[ApiKeys] Create error:", err);
      setError("Failed to create API key. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const deleteKey = async (keyId: string) => {
    if (!confirm("Are you sure you want to delete this API key? This action cannot be undone.")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("api_keys")
        .delete()
        .eq("id", keyId);

      if (error) throw error;
      setKeys(keys.filter(k => k.id !== keyId));
    } catch (err) {
      console.error("[ApiKeys] Delete error:", err);
      setError("Failed to delete API key");
    }
  };

  const copyKey = async (key: string) => {
    await navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">API Keys</h1>
        <p className="text-muted-foreground">
          Manage API keys for programmatic access to BlankLogo
        </p>
      </div>

      {/* New Key Display */}
      {newKey && (
        <div className="mb-6 p-4 rounded-lg border border-green-500/20 bg-green-500/10">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-green-500">API Key Created</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Copy your API key now. You won't be able to see it again!
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-3 rounded bg-black/50 font-mono text-sm break-all">
                  {showKey ? newKey : "•".repeat(40)}
                </code>
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="p-2 hover:bg-muted rounded"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => copyKey(newKey)}
                  className="p-2 hover:bg-muted rounded"
                >
                  {copied ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <button
                onClick={() => setNewKey(null)}
                className="mt-3 text-sm text-muted-foreground hover:text-foreground"
              >
                I've copied my key
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 rounded-lg border border-red-500/20 bg-red-500/10 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <p className="text-red-500">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-400">
            ×
          </button>
        </div>
      )}

      {/* Create New Key */}
      <div className="mb-8 p-6 rounded-lg border bg-card">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Create New API Key
        </h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Key name (e.g., Production, Development)"
            className="flex-1 px-4 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            maxLength={50}
          />
          <button
            onClick={createKey}
            disabled={creating || !newKeyName.trim()}
            className="px-6 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
          >
            {creating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Create Key
              </>
            )}
          </button>
        </div>
      </div>

      {/* Existing Keys */}
      <div className="rounded-lg border bg-card">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Key className="w-5 h-5" />
            Your API Keys
          </h2>
        </div>
        
        {keys.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Key className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No API keys yet</p>
            <p className="text-sm">Create your first API key above</p>
          </div>
        ) : (
          <div className="divide-y">
            {keys.map((key) => (
              <div key={key.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium">{key.name}</div>
                  <div className="text-sm text-muted-foreground flex items-center gap-3">
                    <code className="font-mono">{key.key_prefix}</code>
                    <span>•</span>
                    <span>Created {formatDate(key.created_at)}</span>
                    {key.last_used_at && (
                      <>
                        <span>•</span>
                        <span>Last used {formatDate(key.last_used_at)}</span>
                      </>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => deleteKey(key.id)}
                  className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition"
                  title="Delete key"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* API Documentation Link */}
      <div className="mt-6 p-4 rounded-lg border bg-muted/30">
        <h3 className="font-semibold mb-2">Using Your API Key</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Include your API key in the Authorization header:
        </p>
        <code className="block p-3 rounded bg-black/50 text-sm font-mono">
          Authorization: Bearer bl_your_api_key_here
        </code>
        <a 
          href="/api/docs" 
          className="inline-block mt-3 text-sm text-primary hover:underline"
        >
          View API Documentation →
        </a>
      </div>
    </div>
  );
}
