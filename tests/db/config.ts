// Shared DB test configuration
// Uses environment variables if set, otherwise defaults to local Supabase

export const SUPABASE_URL = process.env.SUPABASE_URL || "http://127.0.0.1:54351";

// JWT format service role key (NOT the sb_secret_ format)
// For production, set SUPABASE_SERVICE_KEY environment variable
export const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

// JWT format anon key
export const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
