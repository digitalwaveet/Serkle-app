import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Camera, Link as LinkIcon, Trash2, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import RichBioEditor from '@/components/RichBioEditor';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import ImageCropper from '@/components/ImageCropper';
import { CustomFilePicker, useFileManager } from '@/components/CustomFilePicker';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EditProfileModal: React.FC<EditProfileModalProps> = ({ isOpen, onClose }) => {
  const { user, updateProfile } = useUser();
  const { toast } = useToast();
  
  const [name, setName] = useState(user?.name || '');
  const [username, setUsername] = useState(user?.username || '');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [bio, setBio] = useState(user?.bio || '');
  const [location, setLocation] = useState(user?.location || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [birthday, setBirthday] = useState(user?.birthday || '');
  const [links, setLinks] = useState<string[]>(
    Array.isArray(user?.website) ? user.website : user?.website ? [user.website] : ['']
  );
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const avatarManager = useFileManager();
  const coverManager = useFileManager();

  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [cropTarget, setCropTarget] = useState<'avatar' | 'cover' | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkUsername = useCallback(async (value: string) => {
    if (!value || !user) return;

    // Same as current — no need to check
    if (value === user.username) {
      setUsernameStatus('idle');
      return;
    }

    // Validate format: lowercase alphanumeric + underscores, 3-30 chars
    if (!/^[a-z0-9_]{3,30}$/.test(value)) {
      setUsernameStatus('invalid');
      return;
    }

    setUsernameStatus('checking');
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', value)
        .neq('id', user.id)
        .limit(1);

      if (error) throw error;
      setUsernameStatus(data && data.length > 0 ? 'taken' : 'available');
    } catch {
      setUsernameStatus('idle');
    }
  }, [user]);

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setUsername(value);
    setUsernameStatus('idle');

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => checkUsername(value), 500);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);



  useEffect(() => {
    const item = avatarManager.files[0];
    if (item) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCropImageSrc(reader.result as string);
        setCropTarget('avatar');
        avatarManager.removeFile(item.id);
      };
      reader.readAsDataURL(item.file as File);
    }
  }, [avatarManager.files]);

  useEffect(() => {
    const item = coverManager.files[0];
    if (item) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCropImageSrc(reader.result as string);
        setCropTarget('cover');
        coverManager.removeFile(item.id);
      };
      reader.readAsDataURL(item.file as File);
    }
  }, [coverManager.files]);

  const handleCropComplete = (croppedBlob: Blob) => {
    const file = new File([croppedBlob], `${cropTarget}-${Date.now()}.jpg`, { type: 'image/jpeg' });
    const previewUrl = URL.createObjectURL(croppedBlob);

    if (cropTarget === 'avatar') {
      setAvatarFile(file);
      setAvatarPreview(previewUrl);
    } else if (cropTarget === 'cover') {
      setCoverFile(file);
      setCoverPreview(previewUrl);
    }

    setCropImageSrc(null);
    setCropTarget(null);
  };

  const handleCropCancel = () => {
    setCropImageSrc(null);
    setCropTarget(null);
  };

  const addLink = () => {
    setLinks([...links, '']);
  };

  const updateLink = (index: number, value: string) => {
    const newLinks = [...links];
    newLinks[index] = value;
    setLinks(newLinks);
  };

  const removeLink = (index: number) => {
    setLinks(links.filter((_, i) => i !== index));
  };

  const canSave = usernameStatus !== 'taken' && usernameStatus !== 'invalid' && usernameStatus !== 'checking';

  const handleSave = async () => {
    if (!user || !canSave) return;
    
    try {
      setIsSaving(true);
      let avatarUrl = user.avatar;
      let coverUrl = user.coverImage;

      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const filePath = `${user.id}/avatar-${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, avatarFile, { upsert: true, contentType: avatarFile.type });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);
        
        avatarUrl = publicUrl;
      }

      if (coverFile) {
        const fileExt = coverFile.name.split('.').pop();
        const filePath = `${user.id}/cover-${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, coverFile, { upsert: true, contentType: coverFile.type });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);
        
        coverUrl = publicUrl;
      }

      await updateProfile({
        name,
        username: username !== user.username ? username : undefined,
        bio,
        location,
        website: links.filter(link => link.trim() !== ''),
        avatar: avatarUrl,
        coverImage: coverUrl,
        phone,
        birthday,
      });

      onClose();
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const usernameHint = () => {
    switch (usernameStatus) {
      case 'checking':
        return (
          <span className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
            <SerkleLoader size="xs" className="text-current" /> Checking availability...
          </span>
        );
      case 'available':
        return (
          <span className="flex items-center gap-1 text-xs text-green-500 mt-1">
            <Check className="h-3 w-3" /> Username is available
          </span>
        );
      case 'taken':
        return (
          <span className="flex items-center gap-1 text-xs text-destructive mt-1">
            <AlertCircle className="h-3 w-3" /> Username is already taken
          </span>
        );
      case 'invalid':
        return (
          <span className="flex items-center gap-1 text-xs text-destructive mt-1">
            <AlertCircle className="h-3 w-3" /> 3-30 chars, lowercase letters, numbers & underscores only
          </span>
        );
      default:
        return null;
    }
  };

  if (!isOpen || !user) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-fade-in">
        <div className="h-full w-full bg-background overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="hover:bg-muted/50"
              >
                <X className="h-5 w-5" />
              </Button>
              <h1 className="text-xl font-bold">Edit Profile</h1>
              <Button onClick={handleSave} size="sm" disabled={isSaving || !canSave}>
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>

          {/* Cover Image Section */}
          <div className="relative h-48 bg-muted">
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `url('${coverPreview || user.coverImage || 'https://images.unsplash.com/photo-1579952363873-27d3bfad9c0d?auto=format&fit=crop&w=1200&q=80'}')`
              }}
            />
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
              <CustomFilePicker manager={coverManager} hideUploadButton hidePreviewList accept="image/*">
                <div className="cursor-pointer">
                  <div className="flex flex-col items-center gap-2 text-white">
                    <div className="p-3 bg-black/50 rounded-full backdrop-blur-sm">
                      <Camera className="h-6 w-6" />
                    </div>
                    <span className="text-sm font-medium">Change cover</span>
                  </div>
                </div>
              </CustomFilePicker>
            </div>
          </div>

          {/* Avatar Section */}
          <div className="relative -mt-16 px-4 mb-4">
            <div className="relative w-32 h-32">
              <Avatar className="w-32 h-32 ring-4 ring-background">
                <AvatarImage 
                  src={avatarPreview || user.avatar} 
                  alt={user.name}
                />
                <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                  {user.initials}
                </AvatarFallback>
              </Avatar>
              <CustomFilePicker manager={avatarManager} hideUploadButton hidePreviewList accept="image/*">
                <div className="absolute bottom-0 right-0 cursor-pointer z-10">
                  <div className="p-2 bg-primary rounded-full border-2 border-background shadow-lg">
                    <Camera className="h-4 w-4 text-primary-foreground" />
                  </div>
                </div>
              </CustomFilePicker>
            </div>
          </div>

          {/* Form Fields */}
          <div className="px-4 py-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={50} />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Username</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
                <Input
                  value={username}
                  onChange={handleUsernameChange}
                  placeholder="username"
                  maxLength={30}
                  className={`pl-8 ${
                    usernameStatus === 'available' ? 'border-green-500 focus-visible:ring-green-500/30' :
                    usernameStatus === 'taken' || usernameStatus === 'invalid' ? 'border-destructive focus-visible:ring-destructive/30' : ''
                  }`}
                />
                {usernameStatus === 'checking' && (
                  <SerkleLoader size="xs" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                )}
                {usernameStatus === 'available' && (
                  <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                )}
                {(usernameStatus === 'taken' || usernameStatus === 'invalid') && (
                  <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive" />
                )}
              </div>
              {usernameHint()}
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Bio</label>
              <p className="text-xs text-muted-foreground mb-2">Use @username for mentions. Select text for bold/italic/underline.</p>
              <RichBioEditor value={bio} onChange={setBio} maxLength={500} rows={4} />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Location</label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, Country" maxLength={100} />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Phone Number</label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+251..." maxLength={20} />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Birthday</label>
              <Input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Links</label>
              <div className="space-y-3">
                {links.map((link, index) => (
                  <div key={index} className="flex gap-2">
                    <div className="flex-1 relative">
                      <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input value={link} onChange={(e) => updateLink(index, e.target.value)} placeholder="https://example.com" className="pl-10" />
                    </div>
                    {links.length > 1 && (
                      <Button variant="ghost" size="icon" onClick={() => removeLink(index)} className="flex-shrink-0">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                {links.length < 5 && (
                  <Button variant="outline" onClick={addLink} className="w-full">Add Link</Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Image Cropper */}
      {cropImageSrc && cropTarget && (
        <ImageCropper
          imageSrc={cropImageSrc}
          aspectRatio={cropTarget === 'avatar' ? 1 : 16 / 9}
          cropShape={cropTarget === 'avatar' ? 'round' : 'rect'}
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
        />
      )}
    </>
  );
};

export default EditProfileModal;
