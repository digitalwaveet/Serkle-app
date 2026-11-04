import React from 'react';
import { X, Type, Sticker, Sparkles, Image as ImageIcon } from 'lucide-react';
import { CustomFilePicker } from '@/components/CustomFilePicker';

interface EditorToolbarProps {
  onCancel: () => void;
  onAddImageSticker: (file: File | Blob) => void;
  onToolSelect: (tool: 'text' | 'sticker' | 'filter') => void;
  onExport: () => void;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  onCancel,
  onAddImageSticker,
  onToolSelect,
  onExport,
}) => {
  return (
    <div className="w-full max-w-[390px] flex items-center justify-between p-3 z-30 relative">
      <button onClick={onCancel} className="p-2 rounded-full bg-card/10 text-white touch-target">
        <X className="size-5" />
      </button>
      <div className="flex items-center gap-2">
        <CustomFilePicker
          manager={undefined}
          onUpload={async (file) => {
            onAddImageSticker(file);
          }}
          accept="image/*,video/*"
          hidePreviewList
        >
          <div className="p-2 rounded-full bg-card/10 text-white hover:bg-card/20 touch-target cursor-pointer">
            <ImageIcon className="size-5" />
          </div>
        </CustomFilePicker>
        <button
          onClick={() => onToolSelect('text')}
          className="p-2 rounded-full bg-card/10 text-white hover:bg-card/20 touch-target"
        >
          <Type className="size-5" />
        </button>
        <button
          onClick={() => onToolSelect('sticker')}
          className="p-2 rounded-full bg-card/10 text-white hover:bg-card/20 touch-target"
        >
          <Sticker className="size-5" />
        </button>
        <button
          onClick={() => onToolSelect('filter')}
          className="p-2 rounded-full bg-card/10 text-white hover:bg-card/20 touch-target"
        >
          <Sparkles className="size-5" />
        </button>
        <button
          onClick={onExport}
          className="px-4 py-2 ml-2 rounded-full bg-white text-black font-semibold text-sm hover:bg-white/90 touch-target"
        >
          Done
        </button>
      </div>
    </div>
  );
};
