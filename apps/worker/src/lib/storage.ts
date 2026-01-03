import * as fs from "fs/promises";
import { createAdminSupabase } from "./supabase";

const supabase = createAdminSupabase();

export interface StorageRef {
  bucket: "project-assets" | "project-outputs";
  path: string;
}

export function splitBucketPath(fullPath: string): StorageRef | null {
  const parts = fullPath.split("/");
  if (parts.length < 2) return null;

  const bucket = parts[0];
  const path = parts.slice(1).join("/");

  if (bucket !== "project-assets" && bucket !== "project-outputs") {
    return null;
  }

  return { bucket, path };
}

export function joinBucketPath(ref: StorageRef): string {
  return `${ref.bucket}/${ref.path}`;
}

export async function uploadFile(
  localPath: string,
  dest: StorageRef,
  contentType: string
): Promise<void> {
  const data = await fs.readFile(localPath);

  const { error } = await supabase.storage
    .from(dest.bucket)
    .upload(dest.path, data, {
      contentType,
      upsert: true,
    });

  if (error) {
    throw new Error(`Failed to upload ${dest.path}: ${error.message}`);
  }
}

export async function uploadBuffer(
  buffer: Buffer | Uint8Array,
  dest: StorageRef,
  contentType: string
): Promise<void> {
  const { error } = await supabase.storage
    .from(dest.bucket)
    .upload(dest.path, buffer, {
      contentType,
      upsert: true,
    });

  if (error) {
    throw new Error(`Failed to upload ${dest.path}: ${error.message}`);
  }
}

export async function downloadFile(
  ref: StorageRef,
  localPath: string
): Promise<void> {
  const { data, error } = await supabase.storage
    .from(ref.bucket)
    .download(ref.path);

  if (error || !data) {
    throw new Error(`Failed to download ${ref.path}: ${error?.message ?? "No data"}`);
  }

  const buffer = Buffer.from(await data.arrayBuffer());
  await fs.writeFile(localPath, buffer);
}

export async function downloadBuffer(ref: StorageRef): Promise<Buffer> {
  const { data, error } = await supabase.storage
    .from(ref.bucket)
    .download(ref.path);

  if (error || !data) {
    throw new Error(`Failed to download ${ref.path}: ${error?.message ?? "No data"}`);
  }

  return Buffer.from(await data.arrayBuffer());
}

export function getPublicUrl(ref: StorageRef): string {
  const { data } = supabase.storage.from(ref.bucket).getPublicUrl(ref.path);
  return data.publicUrl;
}

export function getSignedUrl(ref: StorageRef, expiresIn = 3600): Promise<string> {
  return supabase.storage
    .from(ref.bucket)
    .createSignedUrl(ref.path, expiresIn)
    .then(({ data, error }) => {
      if (error) throw new Error(`Failed to create signed URL: ${error.message}`);
      return data.signedUrl;
    });
}
