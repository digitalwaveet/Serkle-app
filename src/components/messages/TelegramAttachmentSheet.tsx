import React, { useRef, useState } from 'react';
import { Image, Camera, Video, FileText, MapPin, User, X } from 'lucide-react';
import { InlineVideoLoader } from '@/components/ui/VideoLoader';
import { uploadChatMedia } from '@/lib/chatMedia';
import { toast } from 'sonner';
import { CustomFilePicker, useFileManager } from '@/components/CustomFilePicker';
import { useEffect } from 'react';

interface TelegramAttachmentSheetProps {
  open: boolean;
  onClose: () => void;
  conversationId: string;
  senderId: string;
  onSendAttachment: (type: string, url: string, label: string) => void;
  onMediaSelected: (files: File[], type: 'photo' | 'video') => void;
}

const TelegramAttachmentSheet: React.FC<TelegramAttachmentSheetProps> = ({
  open,
  onClose,
  conversationId,
  senderId,
  onSendAttachment,
  onMediaSelected,
}) => {
  const [uploading, setUploading] = useState(false);
  
  const photoManager = useFileManager();
  const cameraManager = useFileManager();
  const videoManager = useFileManager();
  const fileManager = useFileManager();

  useEffect(() => {
    const item = photoManager.files[0];
    if (item) {
      onClose();
      onMediaSelected(photoManager.files.map(f => f.file as File), 'photo');
      photoManager.clearAll();
    }
  }, [photoManager.files]);

  useEffect(() => {
    const item = cameraManager.files[0];
    if (item) {
      onClose();
      onMediaSelected([item.file as File], 'photo');
      cameraManager.clearAll();
    }
  }, [cameraManager.files]);

  useEffect(() => {
    const item = videoManager.files[0];
    if (item) {
      if (item.file && item.file.size > 50 * 1024 * 1024) {
        toast.error('Video must be under 50MB');
        videoManager.clearAll();
        return;
      }
      onClose();
      onMediaSelected([item.file as File], 'video');
      videoManager.clearAll();
    }
  }, [videoManager.files]);

  useEffect(() => {
    const item = fileManager.files[0];
    if (item) {
      const handleFile = async (file: File) => {
        setUploading(true);
        try {
          const reference = await uploadChatMedia(conversationId, file, file.name);
          onSendAttachment('file', reference, `📎 ${file.name}`);
          onClose();
        } catch (error) {
          toast.error(error instanceof Error ? error.message : 'Failed to upload file');
        } finally {
          setUploading(false);
          fileManager.clearAll();
        }
      };
      handleFile(item.file as File);
    }
  }, [fileManager.files]);

  const handleShareLocation = () => {
    onClose();
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const locationText = `📍 Location: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
        const mapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
        onSendAttachment('location', mapsUrl, locationText);
      },
      () => toast.error('Unable to get location'),
      { enableHighAccuracy: true }
    );
  };

  const handleShareContact = () => {
    onClose();
    toast.info('Contact sharing coming soon');
  };

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-50 animate-fade-in"
        onClick={onClose}
      />

      <div className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up">
        <div className="bg-background rounded-t-3xl shadow-2xl border-t border-border/50 safe-bottom">
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>

          <div className="grid grid-cols-3 gap-3 px-6 pb-6 pt-2">
            <CustomFilePicker manager={photoManager} hideUploadButton hidePreviewList accept="image/*" multiple>
              <button className="flex flex-col items-center gap-2.5 p-4 rounded-2xl hover:bg-muted/60 active:scale-95 transition-all w-full">
                <div className="bg-blue-500 w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg">
                  <Image className="h-6 w-6 text-white" />
                </div>
                <span className="text-xs font-medium text-foreground">Photo</span>
              </button>
            </CustomFilePicker>

            <CustomFilePicker manager={cameraManager} hideUploadButton hidePreviewList accept="image/*" useCameraImmediate>
              <button className="flex flex-col items-center gap-2.5 p-4 rounded-2xl hover:bg-muted/60 active:scale-95 transition-all w-full">
                <div className="bg-orange-500 w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg">
                  <Camera className="h-6 w-6 text-white" />
                </div>
                <span className="text-xs font-medium text-foreground">Camera</span>
              </button>
            </CustomFilePicker>

            <CustomFilePicker manager={videoManager} hideUploadButton hidePreviewList accept="video/*">
              <button className="flex flex-col items-center gap-2.5 p-4 rounded-2xl hover:bg-muted/60 active:scale-95 transition-all w-full">
                <div className="bg-red-500 w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg">
                  <Video className="h-6 w-6 text-white" />
                </div>
                <span className="text-xs font-medium text-foreground">Video</span>
              </button>
            </CustomFilePicker>

            <CustomFilePicker manager={fileManager} hideUploadButton hidePreviewList accept="*/*">
              <button className="flex flex-col items-center gap-2.5 p-4 rounded-2xl hover:bg-muted/60 active:scale-95 transition-all w-full">
                <div className="bg-violet-500 w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg">
                  <FileText className="h-6 w-6 text-white" />
                </div>
                <span className="text-xs font-medium text-foreground">File</span>
              </button>
            </CustomFilePicker>

            <button onClick={handleShareLocation} className="flex flex-col items-center gap-2.5 p-4 rounded-2xl hover:bg-muted/60 active:scale-95 transition-all">
              <div className="bg-green-500 w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg">
                <MapPin className="h-6 w-6 text-white" />
              </div>
              <span className="text-xs font-medium text-foreground">Location</span>
            </button>

            <button onClick={handleShareContact} className="flex flex-col items-center gap-2.5 p-4 rounded-2xl hover:bg-muted/60 active:scale-95 transition-all">
              <div className="bg-cyan-500 w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg">
                <User className="h-6 w-6 text-white" />
              </div>
              <span className="text-xs font-medium text-foreground">Contact</span>
            </button>
          </div>

          {uploading && (
            <div className="flex items-center justify-center gap-2 pb-4 text-sm text-muted-foreground">
              <InlineVideoLoader />
              Uploading...
            </div>
          )}
        </div>
      </div>

      {/* Hidden inputs removed in favor of CustomFilePicker */}
    </>
  );
};

export default TelegramAttachmentSheet;
