import heic2any from 'heic2any';
import { toast } from '@/hooks/use-toast';

/**
 * Checks if a file is an Apple HEIC or HEIF image based on MIME type or extension.
 */
export const isHeicFile = (file: File): boolean => {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return (
    type === 'image/heic' || 
    type === 'image/heif' || 
    name.endsWith('.heic') || 
    name.endsWith('.heif')
  );
};

/**
 * Processes a file before upload. If the file is HEIC/HEIF, it converts it to JPEG.
 * Otherwise, it returns the original file.
 */
export const prepareFileForUpload = async (file: File): Promise<File> => {
  if (!isHeicFile(file)) {
    return file;
  }

  try {
    console.log(`[HEIC Conversion] Processing: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`);
    
    // Perform conversion
    const result = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.88,
    });

    // heic2any can return an array if the HEIC is a multi-frame animation or burst
    const blob = Array.isArray(result) ? result[0] : result;

    // Create a new File object
    const newFileName = file.name.replace(/\.(heic|heif)$/i, '.jpg');
    const convertedFile = new File([blob], newFileName, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });

    console.log(`[HEIC Conversion] Success: ${newFileName} (${(convertedFile.size / (1024 * 1024)).toFixed(2)} MB)`);
    return convertedFile;
  } catch (error) {
    console.error('[HEIC Conversion] Error:', error);
    toast({
      title: "Format Error",
      description: "Could not process this image format. Please try a different photo.",
      variant: "destructive",
    });
    // Rethrow to stop the upload process if conversion fails
    throw new Error('HEIC conversion failed');
  }
};
