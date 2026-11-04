import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React from 'react';
import { useUpload, UploadItem } from '@/contexts/UploadContext';
import { Progress } from '@/components/ui/progress';
import { X, CheckCircle2, AlertCircle, Film } from 'lucide-react';

const UploadProgressOverlay: React.FC = () => {
  const { uploads, clearUpload } = useUpload();
  const activeUploads = Object.values(uploads) as UploadItem[];

  if (activeUploads.length === 0) return null;

  return (
    <div className="fixed bottom-20 right-4 z-[100] w-72 flex flex-col gap-3 animate-in slide-in-from-right-5 duration-300">
      {activeUploads.map((upload: UploadItem) => (
        <div 
          key={upload.id}
          className="bg-background/80 backdrop-blur-xl border border-muted/20 rounded-2xl p-4 shadow-2xl overflow-hidden relative"
        >
          {/* Progress background glow */}
          <div 
            className="absolute top-0 left-0 h-1 bg-primary/20 transition-all duration-300" 
            style={{ width: `${upload.progress}%` }}
          />

          <div className="flex items-start gap-3">
            <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              {upload.status === 'uploading' && <SerkleLoader size="xs" className="text-primary" />}
              {upload.status === 'success' && <CheckCircle2 className="size-5 text-green-500" />}
              {upload.status === 'error' && <AlertCircle className="size-5 text-destructive" />}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-sm font-bold truncate pr-4">{upload.title}</p>
                <button 
                  onClick={() => clearUpload(upload.id)}
                  className="text-zinc-400 hover:text-zinc-600 transition-colors"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="flex items-center gap-2 mb-2">
                <Film className="size-3 text-zinc-400" />
                <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">
                  {upload.status === 'uploading' ? `Uploading ${Math.round(upload.progress)}%` : upload.status}
                </span>
              </div>

              <Progress 
                value={upload.progress} 
                className="h-1.5"
              />
              
              {upload.error && (
                <p className="text-[10px] text-destructive mt-1 font-medium truncate">
                  {upload.error}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default UploadProgressOverlay;
