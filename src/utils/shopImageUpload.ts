import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "./imageCompression";

export interface UploadImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

export const uploadShopItemImage = async (
  file: File,
  userId: string,
  options: UploadImageOptions = {}
): Promise<string> => {
  const {
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 0.85,
  } = options;

  // Compress image
  const compressed = await compressImage(file, maxWidth, quality);

  // Generate unique filename
  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

  // Upload to shop-item-images bucket
  const { data, error } = await supabase.storage
    .from('shop-item-images')
    .upload(fileName, compressed.blob, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    throw new Error(`Failed to upload image: ${error.message}`);
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('shop-item-images')
    .getPublicUrl(data.path);

  return publicUrl;
};

export const uploadShopItemImages = async (
  files: File[],
  userId: string,
  options: UploadImageOptions = {}
): Promise<string[]> => {
  if (files.length > 5) {
    throw new Error('Maximum 5 images allowed per item');
  }

  const uploadPromises = files.map(file => 
    uploadShopItemImage(file, userId, options)
  );

  return Promise.all(uploadPromises);
};

export const deleteShopItemImage = async (imageUrl: string): Promise<void> => {
  // Extract path from URL
  const url = new URL(imageUrl);
  const path = url.pathname.split('/shop-item-images/')[1];

  if (!path) {
    throw new Error('Invalid image URL');
  }

  const { error } = await supabase.storage
    .from('shop-item-images')
    .remove([path]);

  if (error) {
    throw new Error(`Failed to delete image: ${error.message}`);
  }
};

export const uploadReviewImage = async (
  file: File,
  userId: string
): Promise<string> => {
  // Compress image
  const compressed = await compressImage(file, 1200, 0.8);

  // Generate unique filename
  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

  // Upload to review-images bucket
  const { data, error } = await supabase.storage
    .from('review-images')
    .upload(fileName, compressed.blob, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    throw new Error(`Failed to upload review image: ${error.message}`);
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('review-images')
    .getPublicUrl(data.path);

  return publicUrl;
};

export const uploadSellerAsset = async (
  file: File,
  userId: string,
  type: 'avatar' | 'logo'
): Promise<string> => {
  // Compress image
  const compressed = await compressImage(file, 800, 0.9);

  // Generate unique filename
  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}/${type}-${Date.now()}.${fileExt}`;

  // Upload to seller-assets bucket
  const { data, error } = await supabase.storage
    .from('seller-assets')
    .upload(fileName, compressed.blob, {
      cacheControl: '3600',
      upsert: true, // Allow updating seller assets
    });

  if (error) {
    throw new Error(`Failed to upload seller asset: ${error.message}`);
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('seller-assets')
    .getPublicUrl(data.path);

  return publicUrl;
};

export const validateImageFile = (file: File): { valid: boolean; error?: string } => {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const maxSize = 5 * 1024 * 1024; // 5MB

  if (!validTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Invalid file type. Only JPG, PNG, and WEBP are allowed.',
    };
  }

  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'File size exceeds 5MB limit.',
    };
  }

  return { valid: true };
};

export const validateImageFiles = (files: File[]): { valid: boolean; error?: string } => {
  if (files.length > 5) {
    return {
      valid: false,
      error: 'Maximum 5 images allowed.',
    };
  }

  for (const file of files) {
    const validation = validateImageFile(file);
    if (!validation.valid) {
      return validation;
    }
  }

  return { valid: true };
};
