import React, { useState } from 'react';
import { SerkleLoader } from '@/components/ui/SerkleLoader';
import { Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CustomFilePicker, useFileManager } from '@/components/CustomFilePicker';

interface UploadResourceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  circleId: string;
  isOwner: boolean;
}

const UploadResourceModal: React.FC<UploadResourceModalProps> = ({ open, onOpenChange, circleId, isOwner }) => {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [resourceType, setResourceType] = useState('PDF');
  const [isPremium, setIsPremium] = useState(false);
  const resourceManager = useFileManager();
  const file = resourceManager.files[0]?.file as File | undefined;
  const [uploading, setUploading] = useState(false);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setResourceType('PDF');
    setIsPremium(false);
    resourceManager.clearAll();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title || !description) {
      toast.error('Please fill all required fields');
      return;
    }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const fileExt = file.name.split('.').pop();
      const filePath = `${circleId}/${Date.now()}_${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from('circle-resources')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const fileSizeMb = parseFloat((file.size / (1024 * 1024)).toFixed(2));

      const { error: insertError } = await supabase
        .from('circle_resources')
        .insert({
          circle_id: circleId,
          uploader_id: user.id,
          title,
          description,
          resource_type: resourceType,
          is_premium: isPremium,
          file_url: filePath,
          file_size_mb: fileSizeMb,
        });

      if (insertError) throw insertError;

      toast.success('Resource uploaded successfully');
      queryClient.invalidateQueries({ queryKey: ['circle-resources', circleId] });
      queryClient.invalidateQueries({ queryKey: ['circle-stats', circleId] });
      resetForm();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload resource');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Resource</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Title *</Label>
            <Input id="title" value={title} onChange={e => setTitle(e.target.value)} placeholder="Resource title" required />
          </div>
          <div>
            <Label htmlFor="description">Description *</Label>
            <Textarea id="description" value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description" required />
          </div>
          <div>
            <Label>Resource Type</Label>
            <Select value={resourceType} onValueChange={setResourceType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PDF">PDF</SelectItem>
                <SelectItem value="Video">Video</SelectItem>
                <SelectItem value="Image">Image</SelectItem>
                <SelectItem value="Document">Document</SelectItem>
                <SelectItem value="Excel">Excel</SelectItem>
                <SelectItem value="ZIP">ZIP</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isOwner && (
            <div className="flex items-center justify-between">
              <Label htmlFor="premium">Premium Only</Label>
              <Switch id="premium" checked={isPremium} onCheckedChange={setIsPremium} />
            </div>
          )}
          <div>
            <Label>File *</Label>
            <CustomFilePicker 
              manager={resourceManager} 
              hideUploadButton 
              maxFileSizeMB={50}
            />
          </div>
          <Button type="submit" className="w-full" disabled={uploading}>
            <Upload className="h-4 w-4 mr-2" />
            {uploading ? <><SerkleLoader size="xs" className="text-current" label="Uploading resource" /> Uploading...</> : 'Upload Resource'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default UploadResourceModal;
