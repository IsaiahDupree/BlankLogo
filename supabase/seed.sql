-- ============================================
-- CanvasCast Seed Data
-- Storage buckets and initial data
-- ============================================

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public, avif_autodetection)
VALUES 
  ('project-assets', 'project-assets', false, false),
  ('project-outputs', 'project-outputs', false, false)
ON CONFLICT (id) DO NOTHING;
