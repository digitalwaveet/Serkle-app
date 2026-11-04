/**
 * Compress and resize image before upload
 * @param file - Original image file
 * @param maxWidth - Maximum width in pixels (default: 1200)
 * @param quality - JPEG quality 0-1 (default: 0.8)
 * @returns Compressed blob and metadata
 */
export const compressImage = async (
  file: File,
  maxWidth: number = 1200,
  quality: number = 0.8
): Promise<{ blob: Blob; width: number; height: number; originalSize: number; compressedSize: number }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onerror = () => reject(new Error('Failed to load image'));
      
      img.onload = () => {
        // Calculate new dimensions
        let { width, height } = img;
        
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        // Draw image with better quality
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'));
              return;
            }
            
            resolve({
              blob,
              width,
              height,
              originalSize: file.size,
              compressedSize: blob.size,
            });
          },
          'image/jpeg',
          quality
        );
      };
      
      img.src = e.target?.result as string;
    };
    
    reader.readAsDataURL(file);
  });
};

/**
 * Format file size for display
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

/**
 * Calculate compression ratio
 */
export const getCompressionRatio = (originalSize: number, compressedSize: number): number => {
  return Math.round(((originalSize - compressedSize) / originalSize) * 100);
};
