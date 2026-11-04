import React, { createContext, useContext, useState, useCallback } from 'react';

export type UploadStatus = 'uploading' | 'success' | 'error';

export interface UploadItem {
  id: string;
  title: string;
  progress: number;
  status: UploadStatus;
  error?: string;
  circleId?: string;
}

interface UploadContextType {
  uploads: Record<string, UploadItem>;
  addUpload: (item: Omit<UploadItem, 'progress' | 'status'>) => void;
  updateProgress: (id: string, progress: number) => void;
  completeUpload: (id: string, success: boolean, error?: string) => void;
  clearUpload: (id: string) => void;
}

const UploadContext = createContext<UploadContextType | undefined>(undefined);

export const UploadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [uploads, setUploads] = useState<Record<string, UploadItem>>({});

  const addUpload = useCallback((item: Omit<UploadItem, 'progress' | 'status'>) => {
    setUploads((prev: Record<string, UploadItem>) => ({
      ...prev,
      [item.id]: { ...item, progress: 0, status: 'uploading' }
    }));
  }, []);

  const updateProgress = useCallback((id: string, progress: number) => {
    setUploads((prev: Record<string, UploadItem>) => {
      if (!prev[id]) return prev;
      return {
        ...prev,
        [id]: { ...prev[id], progress }
      };
    });
  }, []);

  const completeUpload = useCallback((id: string, success: boolean, error?: string) => {
    setUploads((prev: Record<string, UploadItem>) => {
      if (!prev[id]) return prev;
      return {
        ...prev,
        [id]: { 
          ...prev[id], 
          status: success ? 'success' : 'error', 
          error,
          progress: success ? 100 : prev[id].progress 
        }
      };
    });
    
    // Auto-clear success after some time
    if (success) {
      setTimeout(() => clearUpload(id), 5000);
    }
  }, []);

  const clearUpload = useCallback((id: string) => {
    setUploads((prev: Record<string, UploadItem>) => {
      const newUploads = { ...prev };
      delete newUploads[id];
      return newUploads;
    });
  }, []);

  return (
    <UploadContext.Provider value={{ uploads, addUpload, updateProgress, completeUpload, clearUpload }}>
      {children}
    </UploadContext.Provider>
  );
};

export const useUpload = () => {
  const context = useContext(UploadContext);
  if (context === undefined) {
    throw new Error('useUpload must be used within an UploadProvider');
  }
  return context;
};
