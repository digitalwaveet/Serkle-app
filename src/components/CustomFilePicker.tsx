import { SerkleLoader } from '@/components/ui/SerkleLoader';
/**
 * CustomFilePicker.tsx — Full corrected version
 *
 * ─── Install required packages ────────────────────────────────────────────────
 *   npm install @capacitor/camera @capacitor/app @capacitor/filesystem
 *   npx cap sync
 *
 * ─── Android permissions (android/app/src/main/AndroidManifest.xml) ──────────
 *   <uses-permission android:name="android.permission.CAMERA" />
 *   <uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
 *   <uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />
 *
 * ─── iOS permissions (ios/App/App/Info.plist) ─────────────────────────────────
 *   <key>NSCameraUsageDescription</key>
 *   <string>We need camera access to take photos.</string>
 *   <key>NSPhotoLibraryUsageDescription</key>
 *   <string>We need access to your photo library.</string>
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   import { CustomFilePicker } from './CustomFilePicker';
 *   import { supabase } from '@/integrations/supabase/client';
 *
 *   function App() {
 *     const handleUpload = async (
 *       file: File | Blob,
 *       meta: { name: string; type: string; size: number; path: string }
 *     ) => {
 *       const { data, error } = await supabase.storage
 *         .from('your-bucket')
 *         .upload(meta.path, file, { contentType: meta.type });
 *       if (error) throw error;
 *       return data;
 *     };
 *
 *     return (
 *       <div className="p-4 max-w-md mx-auto">
 *         <CustomFilePicker
 *           onUpload={handleUpload}
 *           onComplete={(results) => console.log('All done', results)}
 *           maxFileSizeMB={50}
 *           storagePath="uploads"          // optional — prefix for Supabase path
 *           userId="user-uuid-here"        // optional — added to storage path
 *         />
 *       </div>
 *     );
 *   }
 */

import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
} from 'react';
import { Capacitor } from '@capacitor/core';
import { toast } from 'sonner';
import { useNavigation } from '@/contexts/NavigationContext';

import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export type UploadStatus = 'idle' | 'uploading' | 'done' | 'error';
export type FileKind = 'image' | 'video' | 'file';

export interface FileItem {
  id: string;
  file: File | Blob;
  url: string;           // local object URL for preview
  kind: FileKind;
  name: string;
  size: number;
  mimeType: string;
  status: UploadStatus;
  errorMessage?: string;
  result?: unknown;
}

export interface UploadMeta {
  name: string;
  type: string;          // mime type
  size: number;
  path: string;          // suggested Supabase storage path
}

export interface CustomFilePickerProps {
  /** Called per-file on upload. Must throw on failure. Optional if using purely as a selector. */
  onUpload?: (file: File | Blob, meta: UploadMeta) => Promise<unknown>;
  /** Called once all uploads settle */
  onComplete?: (results: { id: string; status: UploadStatus }[]) => void;
  /** Max file size in MB. Default: 100 */
  maxFileSizeMB?: number;
  /** Storage path prefix e.g. "uploads". Default: "uploads" */
  storagePath?: string;
  /** User ID appended to path for namespacing */
  userId?: string;
  /** Optional external file manager to lift state up */
  manager?: ReturnType<typeof useFileManager>;
  /** Hide the built-in upload button */
  hideUploadButton?: boolean;
  /** Hide the built-in file preview list */
  hidePreviewList?: boolean;
  /** Optionally restrict the action sheet options. E.g., "image/*" */
  accept?: string;
  /** Allow multiple file selection. Default: false */
  multiple?: boolean;
  /** Maximum number of files allowed. Only applicable if multiple is true. */
  maxFiles?: number;
  /** Skip the action sheet and open the camera immediately. Default: false */
  useCameraImmediate?: boolean;
  /**
   * Render the source picker inline: tapping the trigger expands a horizontal row
   * of source icons next to it, instead of opening the bottom action sheet.
   * Default: false.
   */
  expandInline?: boolean;
  /** Direction the inline row expands toward. Default: 'right'. */
  expandDirection?: 'left' | 'right';
  /** Disable the picker interaction. Default: false */
  disabled?: boolean;
  /** Auto-open the action sheet on mount. Default: false */
  autoOpen?: boolean;
  /** Called when the action sheet is dismissed without a file being selected */
  onSheetDismiss?: () => void;
  /** Optional custom trigger children */
  children?: React.ReactNode;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const genId = () => Math.random().toString(36).slice(2, 9);

const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`;
};

const detectKind = (mimeType: string, fileName?: string): FileKind | null => {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (fileName) {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'bmp', 'svg'].includes(ext)) return 'image';
    if (['mp4', 'mov', 'webm', 'm4v', '3gp', 'mkv', 'avi'].includes(ext)) return 'video';
  }
  return null;
};

const fileExtIcon: Record<string, string> = {
  pdf: '📄', doc: '📝', docx: '📝',
  xls: '📊', xlsx: '📊', csv: '📊',
  zip: '🗜️', rar: '🗜️',
  mp3: '🎵', wav: '🎵',
  txt: '📃', md: '📃',
};

const getIcon = (name: string): string => {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return fileExtIcon[ext] ?? '📎';
};

// ─── useFileManager ───────────────────────────────────────────────────────────

export function useFileManager() {
  const [files, setFiles] = useState<FileItem[]>([]);

  // FIX #1: Use a ref to hold latest files so the cleanup effect
  // always revokes the most recent object URLs, not stale closure values.
  const filesRef = useRef<FileItem[]>([]);
  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  // Revoke all object URLs on unmount
  useEffect(() => {
    return () => {
      filesRef.current.forEach((f) => URL.revokeObjectURL(f.url));
    };
  }, []);

  const addFiles = useCallback((items: FileItem[]) => {
    setFiles((prev) => [...prev, ...items]);
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((f) => f.id !== id);
    });
  }, []);

  const updateStatus = useCallback(
    (id: string, status: UploadStatus, errorMessage?: string, result?: unknown) => {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === id ? { ...f, status, ...(errorMessage ? { errorMessage } : {}), ...(result ? { result } : {}) } : f
        )
      );
    },
    []
  );

  const updateFile = useCallback((id: string, updates: Partial<FileItem>) => {
    setFiles((prev) =>
      prev.map((f) => {
        if (f.id === id) {
          if (updates.url && updates.url !== f.url) {
            URL.revokeObjectURL(f.url);
          }
          return { ...f, ...updates };
        }
        return f;
      })
    );
  }, []);

  const clearAll = useCallback(() => {
    setFiles((prev) => {
      prev.forEach((f) => URL.revokeObjectURL(f.url));
      return [];
    });
  }, []);

  // Memoize the manager object to prevent infinite re-renders in consumers
  return React.useMemo(() => ({ 
    files, 
    addFiles, 
    removeFile, 
    updateStatus, 
    updateFile,
    clearAll,
    clear: clearAll,
    setFiles
  }), [files, addFiles, removeFile, updateStatus, updateFile, clearAll]);
}

// ─── CustomFilePicker Component ───────────────────────────────────────────────

export const CustomFilePicker: React.FC<CustomFilePickerProps> = ({
  onUpload,
  onComplete,
  maxFileSizeMB = 100,
  storagePath = 'uploads',
  userId,
  manager: externalManager,
  hideUploadButton = false,
  hidePreviewList = false,
  accept,
  multiple = false,
  maxFiles,
  useCameraImmediate = false,
  disabled = false,
  expandInline = false,
  expandDirection = 'right',
  autoOpen = false,
  onSheetDismiss,
  children,
}) => {
  const internalManager = useFileManager();
  const { files, addFiles, removeFile, updateStatus, clearAll } = externalManager ?? internalManager;
  const { pushModalState } = useNavigation();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [sizeError, setSizeError] = useState<string | null>(null);

  // Track when user is actively selecting a file from system picker
  const isSelectingRef = useRef(false);

  const handleOpenSheet = () => {
    pushModalState('file-picker-sheet', () => {
      isSelectingRef.current = false;
      setSheetOpen(false);
    });
    setSheetOpen(true);
  };

  // Auto-open the sheet on mount when autoOpen is true
  const didAutoOpenRef = useRef(false);
  useEffect(() => {
    if (autoOpen && !didAutoOpenRef.current) {
      didAutoOpenRef.current = true;
      // Small delay so the component is fully mounted
      requestAnimationFrame(() => handleOpenSheet());
    }
    if (!autoOpen) {
      didAutoOpenRef.current = false;
    }
  }, [autoOpen]);

  // Collapse whichever picker surface is open (bottom sheet or inline pill).
  const closeSheet = useCallback(() => {
    setSheetOpen(false);
    setExpanded(false);
  }, []);

  // Track when sheet closes: if no files were added and user didn't choose a source, notify parent
  const prevSheetOpenRef = useRef(false);
  useEffect(() => {
    // Detect sheet closing (was open, now closed)
    if (prevSheetOpenRef.current && !sheetOpen) {
      // Give a short delay for file processing to complete
      const t = setTimeout(() => {
        if (!isSelectingRef.current && files.length === 0 && onSheetDismiss) {
          onSheetDismiss();
        }
      }, 400);
      return () => clearTimeout(t);
    }
    prevSheetOpenRef.current = sheetOpen;
  }, [sheetOpen, files.length, onSheetDismiss]);

  // Inline pill: collapse on any outside interaction.
  useEffect(() => {
    if (!expanded) return;
    const onOutside = () => setExpanded(false);
    document.addEventListener('pointerdown', onOutside);
    return () => document.removeEventListener('pointerdown', onOutside);
  }, [expanded]);

  // Hidden file inputs — one per accept type for clean separation
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const anyInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null); // New generic file input

  const maxBytes = maxFileSizeMB * 1024 * 1024;


  // ── File list builder ───────────────────────────────────────────────────────
  const buildItems = (rawFiles: FileList | null, fallbackKind: FileKind = 'file'): FileItem[] => {
    if (!rawFiles) return [];
    const oversized: string[] = [];

    const items: FileItem[] = Array.from(rawFiles).reduce<FileItem[]>((acc, file) => {
      if (file.size > maxBytes) {
        oversized.push(file.name);
        return acc;
      }
      const mimeType = file.type || 'application/octet-stream';
      const kind = detectKind(mimeType, file.name) ?? fallbackKind;
      acc.push({
        id: genId(),
        file,
        url: URL.createObjectURL(file),
        kind,
        name: file.name,
        size: file.size,
        mimeType,
        status: 'idle',
      });
      return acc;
    }, []);

    if (oversized.length > 0) {
      setSizeError(
        `${oversized.length} file(s) exceeded ${maxFileSizeMB} MB limit and were skipped.`
      );
      setTimeout(() => setSizeError(null), 4000);
    }

    return items;
  };

  const handleCancelSelection = () => {
    isSelectingRef.current = false;
    if (files.length === 0 && onSheetDismiss) {
      onSheetDismiss();
    }
  };

  const processInput = (e: React.ChangeEvent<HTMLInputElement>, kind: FileKind = 'file') => {
    isSelectingRef.current = false;
    let items = buildItems(e.target.files, kind);
    if (items.length) {
      if (multiple && maxFiles && (files.length + items.length > maxFiles)) {
        const allowedCount = maxFiles - files.length;
        if (allowedCount <= 0) {
          toast.error(`You can only select up to ${maxFiles} files.`);
          return;
        }
        toast.warning(`Only the first ${allowedCount} files were added to stay within the ${maxFiles} file limit.`);
        items = items.slice(0, allowedCount);
      }
      addFiles(items);
    }
    // Reset so the same file can be picked again
    e.target.value = '';
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    isSelectingRef.current = false;
    let items = buildItems(e.target.files, 'file'); // Default to 'file' kind
    if (items.length) {
      if (multiple && maxFiles && (files.length + items.length > maxFiles)) {
        const allowedCount = maxFiles - files.length;
        if (allowedCount <= 0) {
          toast.error(`You can only select up to ${maxFiles} files.`);
          return;
        }
        toast.warning(`Only the first ${allowedCount} files were added to stay within the ${maxFiles} file limit.`);
        items = items.slice(0, allowedCount);
      }
      addFiles(items);
    }
    e.target.value = ''; // Reset input
  };

  // ── Action sheet handlers ───────────────────────────────────────────────────

  // Always close sheet first, then trigger input after animation
  const closeAndTrigger = (triggerFn: () => void) => {
    closeSheet();
    setTimeout(triggerFn, 300); // wait for sheet slide-down animation
  };

  const handleCamera = async () => {
    isSelectingRef.current = true;
    closeSheet();

    if (Capacitor.isNativePlatform()) {
      try {
        const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
        const photo = await Camera.getPhoto({
          quality: 90,
          allowEditing: false,
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Camera,
        });

        isSelectingRef.current = false;
        if (photo.dataUrl) {
          const blob = await fetch(photo.dataUrl).then((r) => r.blob());
          const ext = photo.format ?? 'jpeg';
          const name = `camera_${Date.now()}.${ext}`;
          addFiles([{
            id: genId(),
            file: blob,
            url: URL.createObjectURL(blob),
            kind: 'image',
            name,
            size: blob.size,
            mimeType: blob.type || `image/${ext}`,
            status: 'idle',
          }]);
        }
      } catch (err: any) {
        isSelectingRef.current = false;
        if (err?.message !== 'User cancelled photos app' && !err?.message?.toLowerCase().includes('cancel')) {
          console.error('Camera error:', err);
        } else {
          if (files.length === 0 && onSheetDismiss) {
            onSheetDismiss();
          }
        }
      }
    } else {
      // Web fallback with capture attribute
      setTimeout(() => {
        imageInputRef.current?.setAttribute('capture', 'environment');
        imageInputRef.current?.click();
      }, 300);
    }
  };

  const handlePhotoLibrary = async () => {
    isSelectingRef.current = true;
    closeSheet();

    if (Capacitor.isNativePlatform()) {
      try {
        const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
        const photo = await Camera.getPhoto({
          quality: 90,
          allowEditing: false,
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Photos,
        });

        isSelectingRef.current = false;
        if (photo.dataUrl) {
          const blob = await fetch(photo.dataUrl).then((r) => r.blob());
          const ext = photo.format ?? 'jpeg';
          const name = `photo_${Date.now()}.${ext}`;
          addFiles([{
            id: genId(),
            file: blob,
            url: URL.createObjectURL(blob),
            kind: 'image',
            name,
            size: blob.size,
            mimeType: blob.type || `image/${ext}`,
            status: 'idle',
          }]);
        }
      } catch (err: any) {
        isSelectingRef.current = false;
        if (err?.message !== 'User cancelled photos app' && !err?.message?.toLowerCase().includes('cancel')) {
          console.error('Photo library error:', err);
        } else {
          if (files.length === 0 && onSheetDismiss) {
            onSheetDismiss();
          }
        }
      }
    } else {
      closeAndTrigger(() => {
        imageInputRef.current?.removeAttribute('capture');
        imageInputRef.current?.click();
      });
    }
  };

  const handleVideo = () => {
    isSelectingRef.current = true;
    closeAndTrigger(() => videoInputRef.current?.click());
  };

  const handleAnyFile = () => {
    isSelectingRef.current = true;
    closeAndTrigger(() => {
      if (fileInputRef.current) {
        fileInputRef.current.accept = accept || ''; // Set accept prop
        fileInputRef.current.multiple = multiple; // Set multiple prop
        fileInputRef.current.click();
      }
    });
  };

  // ── Upload ──────────────────────────────────────────────────────────────────

  const buildStoragePath = (name: string): string => {
    const timestamp = Date.now();
    const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_');
    return [storagePath, userId, `${timestamp}_${safeName}`]
      .filter(Boolean)
      .join('/');
  };

  const handleUploadAll = async () => {
    if (!onUpload) return;
    const pending = files.filter((f) => f.status === 'idle' || f.status === 'error');
    if (!pending.length) return;

    setIsUploading(true);

    const results = await Promise.allSettled(
      pending.map(async (f) => {
        updateStatus(f.id, 'uploading');
        try {
          const meta = {
            name: f.name,
            type: f.mimeType,
            size: f.size,
            path: buildStoragePath(f.name),
          };
          const res = await onUpload(f.file, meta);
          updateStatus(f.id, 'done', undefined, res);
          return { id: f.id, status: 'done' as UploadStatus };
        } catch (err: any) {
          const msg = err?.message ?? 'Upload failed';
          updateStatus(f.id, 'error', msg);
          return { id: f.id, status: 'error' as UploadStatus };
        }
      })
    );

    setIsUploading(false);

    onComplete?.(
      results.map((r) =>
        r.status === 'fulfilled' ? r.value : { id: '', status: 'error' as UploadStatus }
      )
    );
  };

  // ── Derived state ───────────────────────────────────────────────────────────
  const pendingCount = files.filter((f) => f.status === 'idle' || f.status === 'error').length;
  const allDone = files.length > 0 && files.every((f) => f.status === 'done');

  // ── Source options (shared by the bottom sheet and the inline pill) ──────────
  const sources: { key: string; label: string; color: SheetColor; icon: React.ReactNode; onClick: () => void }[] = [
    (!accept || accept.includes('image')) && {
      key: 'camera', label: 'Camera', color: 'blue' as SheetColor, onClick: handleCamera,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    (!accept || accept.includes('image')) && {
      key: 'photos', label: 'Photo Library', color: 'purple' as SheetColor, onClick: handlePhotoLibrary,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    (!accept || accept.includes('video')) && {
      key: 'video', label: 'Video', color: 'red' as SheetColor, onClick: handleVideo,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      ),
    },
    (!accept || (!accept.includes('video') && !accept.includes('image'))) && {
      key: 'file', label: 'Any File', color: 'orange' as SheetColor, onClick: handleAnyFile,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
  ].filter(Boolean) as { key: string; label: string; color: SheetColor; icon: React.ReactNode; onClick: () => void }[];

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="w-full relative pointer-events-none flex flex-col">

      {/* Hidden inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        className="hidden"
        onChange={(e) => processInput(e, 'image')}
        onCancel={handleCancelSelection}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        multiple={multiple}
        className="hidden"
        onChange={(e) => processInput(e, 'video')}
        onCancel={handleCancelSelection}
      />
      <input
        ref={anyInputRef}
        type="file"
        multiple={multiple}
        className="hidden"
        onChange={(e) => processInput(e, 'file')}
        onCancel={handleCancelSelection}
      />
      {/* New generic file input for 'Any File' option, respecting accept/multiple props */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        onCancel={handleCancelSelection}
        className="hidden"
      />

      {/* Size error toast */}
      {sizeError && (
        <div className="flex items-center gap-2 px-4 py-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-xl animate-in fade-in slide-in-from-top-2 duration-200">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          {sizeError}
        </div>
      )}

      {/* Inline expanding row — the trigger stays put and a row of source icons grows out beside it */}
      {expandInline ? (
        <div
          className="pointer-events-auto relative inline-flex self-center"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* Trigger (keeps the caller's icon/button) */}
          <div
            role="button"
            tabIndex={disabled ? -1 : 0}
            aria-expanded={expanded}
            aria-label="Choose source"
            onClick={() => !disabled && setExpanded((v) => !v)}
            className={cn("relative z-10", disabled && "opacity-50 pointer-events-none")}
          >
            {children ?? (
              <div className="p-3 rounded-full bg-card/10 text-foreground hover:bg-card/20 cursor-pointer">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}
          </div>

          {/* Expanding source row — anchored beside the trigger, grows toward expandDirection */}
          <div
            style={{ maxWidth: expanded ? `${sources.length * 3.2 + 0.8}rem` : '0rem' }}
            className={cn(
              "absolute top-1/2 -translate-y-1/2 flex items-center gap-1.5 overflow-hidden rounded-full bg-black/50 backdrop-blur-md",
              "transition-[max-width,opacity,padding] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
              expandDirection === 'left'
                ? "right-full mr-2 flex-row-reverse"
                : "left-full ml-2 flex-row",
              expanded ? "opacity-100 p-1.5" : "opacity-0 p-0 pointer-events-none"
            )}
            aria-hidden={!expanded}
          >
            {sources.map((s, i) => (
              <button
                key={s.key}
                type="button"
                onClick={s.onClick}
                style={{ transitionDelay: expanded ? `${100 + i * 70}ms` : '0ms' }}
                className={cn(
                  "shrink-0 w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  colorMap[s.color],
                  expanded ? "opacity-100 scale-100" : "opacity-0 scale-50"
                )}
                aria-label={s.label}
                title={s.label}
                tabIndex={expanded ? 0 : -1}
              >
                {s.icon}
              </button>
            ))}
          </div>
        </div>
      ) : children ? (
        <div 
          onClick={(e) => {
            if (disabled) return;
            e.stopPropagation();
            if (useCameraImmediate) {
              handleCamera();
            } else {
              handleOpenSheet();
            }
          }} 
          className={cn("cursor-pointer pointer-events-auto", disabled && "cursor-not-allowed")}
        >
          {children}
        </div>
      ) : autoOpen ? (
        /* autoOpen mode — no trigger needed, the sheet opens on its own */
        null
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            if (useCameraImmediate) {
              handleCamera();
            } else {
              handleOpenSheet();
            }
          }}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground font-semibold rounded-xl shadow-sm hover:opacity-90 active:scale-95 transition-all w-full pointer-events-auto disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed"
          aria-label="Open file picker"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Files
        </button>
      )}

      {/* ── File preview list ─────────────────────────────────────────────── */}
      {!hidePreviewList && files.length > 0 && (
        <div className="flex flex-col gap-3 mt-4 animate-in fade-in zoom-in-95 duration-200 pointer-events-auto">
          <div className="max-h-[55vh] overflow-y-auto flex flex-col gap-3 pr-1">
            {files.map((f) => (
              <FileRow
                key={f.id}
                item={f}
                onRemove={removeFile}
              />
            ))}
          </div>

          {/* Action row */}
          {!hideUploadButton && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={clearAll}
                disabled={isUploading}
                className="flex items-center justify-center gap-1.5 px-4 py-3 bg-muted text-muted-foreground font-medium rounded-xl hover:bg-muted/80 disabled:opacity-40 transition-colors text-sm"
                aria-label="Clear all files"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Clear
              </button>

              <button
                type="button"
                onClick={handleUploadAll}
                disabled={isUploading || allDone || pendingCount === 0 || !onUpload}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed transition-colors"
                aria-label={allDone ? 'All uploaded' : `Upload ${pendingCount} files`}
              >
                {isUploading ? (
                  <>
                    <SerkleLoader size="xs" className="text-current" />
                    Uploading…
                  </>
                ) : allDone ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    {/* FIX #5: Proper "all done" label */}
                    All Uploaded
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Upload {pendingCount} {pendingCount === 1 ? 'File' : 'Files'}
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Backdrop ─────────────────────────────────────────────────────── */}
      {!expandInline && sheetOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200 pointer-events-auto"
          onClick={() => {
            isSelectingRef.current = false;
            setSheetOpen(false);
          }}
          aria-hidden="true"
        />
      )}

      {/* ── Bottom Action Sheet ───────────────────────────────────────────── */}
      {!expandInline && (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="File source picker"
        className={`fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-[2rem] shadow-2xl flex flex-col transition-transform duration-300 ease-out ${sheetOpen ? 'translate-y-0 pointer-events-auto visible' : 'translate-y-full pointer-events-none invisible'
          }`}
      >
        {/* Drag handle */}
        <div className="w-full flex justify-center mt-3 mb-1">
          <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
        </div>

        <p className="text-center text-xs font-semibold tracking-widest uppercase text-muted-foreground px-4 py-2">
          Choose Source
        </p>

        <div className="px-4 pb-2 flex flex-col gap-1">
          {(!accept || accept.includes('image')) && (
            <>
              <SheetOption
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                }
                label="Camera"
                color="blue"
                onClick={handleCamera}
              />
              <SheetOption
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                }
                label="Photo Library"
                color="purple"
                onClick={handlePhotoLibrary}
              />
            </>
          )}
          {(!accept || accept.includes('video')) && (
            <SheetOption
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              }
              label="Video"
              color="red"
              onClick={handleVideo}
            />
          )}
          {(!accept || (!accept.includes('video') && !accept.includes('image'))) && (
            <SheetOption
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              }
              label="Any File"
              color="orange"
              onClick={handleAnyFile}
            />
          )}
        </div>

        {/* Cancel */}
        <div className="px-4 pb-10 pt-2">
          <button
            type="button"
            onClick={() => {
              isSelectingRef.current = false;
              setSheetOpen(false);
            }}
            className="w-full py-4 bg-muted hover:bg-muted/70 text-foreground font-bold rounded-2xl active:scale-[0.98] transition-all"
            aria-label="Cancel"
          >
            Cancel
          </button>
        </div>
      </div>
      )}
    </div>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

interface FileRowProps {
  item: FileItem;
  onRemove: (id: string) => void;
}

const FileRow: React.FC<FileRowProps> = ({ item, onRemove }) => {
  const isRemoving = item.status === 'uploading';

  return (
    <div className="relative flex items-center gap-3 p-3 bg-card border border-border rounded-xl shadow-sm">
      {/* Remove button */}
      <button
        type="button"
        onClick={() => onRemove(item.id)}
        disabled={isRemoving}
        className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center shadow hover:scale-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all z-10"
        aria-label={`Remove ${item.name}`}
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Thumbnail */}
      <div className="w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-muted flex items-center justify-center relative">
        {item.kind === 'image' && (
          <img src={item.url} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
        )}
        {item.kind === 'video' && (
          <>
            {/* FIX: preload="metadata" so thumbnail shows immediately */}
            <video src={item.url} className="w-full h-full object-cover" preload="metadata" muted playsInline />
            <div className="absolute inset-0 flex items-center justify-center bg-black/25">
              <svg className="w-6 h-6 text-white drop-shadow" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </>
        )}
        {item.kind === 'file' && (
          <span className="text-2xl" role="img" aria-label="file icon">
            {getIcon(item.name)}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <span className="text-sm font-semibold truncate text-foreground leading-tight">
          {item.name}
        </span>
        <span className="text-xs text-muted-foreground">
          {formatSize(item.size)} · {item.kind.charAt(0).toUpperCase() + item.kind.slice(1)}
        </span>

        {/* Status badge */}
        <StatusBadge status={item.status} errorMessage={item.errorMessage} />
      </div>
    </div>
  );
};

interface StatusBadgeProps {
  status: UploadStatus;
  errorMessage?: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, errorMessage }) => {
  const base = 'text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full border w-fit';
  switch (status) {
    case 'idle':
      return <span className={`${base} text-muted-foreground bg-muted/50 border-border`}>Ready</span>;
    case 'uploading':
      return <span className={`${base} text-blue-600 bg-blue-500/10 border-blue-500/20 inline-flex items-center gap-1.5`}><SerkleLoader size="xs" className="text-current" label="Uploading file" />Uploading…</span>;
    case 'done':
      return <span className={`${base} text-green-600 bg-green-500/10 border-green-500/20`}>✓ Done</span>;
    case 'error':
      return (
        <span className={`${base} text-destructive bg-destructive/10 border-destructive/20`} title={errorMessage}>
          ✕ Failed
        </span>
      );
  }
};

type SheetColor = 'blue' | 'purple' | 'red' | 'orange';

interface SheetOptionProps {
  icon: React.ReactNode;
  label: string;
  color: SheetColor;
  onClick: () => void;
}

const colorMap: Record<SheetColor, string> = {
  blue: 'bg-blue-500/10 text-blue-500',
  purple: 'bg-purple-500/10 text-purple-500',
  red: 'bg-red-500/10 text-red-500',
  orange: 'bg-orange-500/10 text-orange-500',
};

const SheetOption: React.FC<SheetOptionProps> = ({ icon, label, color, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full flex items-center gap-4 p-4 hover:bg-muted/50 active:bg-muted rounded-2xl transition-colors text-left"
    aria-label={label}
  >
    <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${colorMap[color]}`}>
      {icon}
    </div>
    <span className="font-semibold text-foreground text-base">{label}</span>
  </button>
);
