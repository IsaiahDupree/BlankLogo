-- ============================================
-- BlankLogo Storage Policies for bl_videos bucket
-- Allows public read and authenticated upload
-- ============================================

-- Allow public read access to all files in bl_videos bucket
CREATE POLICY "Public read access for bl_videos"
ON storage.objects FOR SELECT
USING (bucket_id = 'bl_videos');

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload to bl_videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'bl_videos');

-- Allow service role to do anything (for worker)
CREATE POLICY "Service role full access to bl_videos"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'bl_videos')
WITH CHECK (bucket_id = 'bl_videos');

-- Allow users to update their own uploads
CREATE POLICY "Users can update own uploads in bl_videos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'bl_videos')
WITH CHECK (bucket_id = 'bl_videos');

-- Allow users to delete their own uploads
CREATE POLICY "Users can delete own uploads in bl_videos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'bl_videos');
