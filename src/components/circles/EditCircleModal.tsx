import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Camera, X, Plus } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { type Circle } from '@/hooks/useCircles';
import { useCircleMutations } from '@/hooks/useCircleMutations';
import { CIRCLE_TYPES, CIRCLE_FEATURES, normalizeFeatures, type CircleFeature } from '@/lib/circleTypes';
import { useUser } from '@/contexts/UserContext';
import { toast } from 'sonner';
import ImageCropper from '@/components/ImageCropper';
import { CustomFilePicker, useFileManager } from '@/components/CustomFilePicker';

interface EditCircleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  circle: Circle;
  onSuccess?: () => void;
}

const EditCircleModal: React.FC<EditCircleModalProps> = ({ 
  open, 
  onOpenChange, 
  circle,
  onSuccess 
}) => {
  const { user } = useUser();
  const { updateCircle } = useCircleMutations();
  
  const [name, setName] = useState(circle.name);
  const [description, setDescription] = useState(circle.description);
  const [aboutSection, setAboutSection] = useState(circle.about_text || '');
  const [guidelines, setGuidelines] = useState<string[]>(
    circle.guidelines && circle.guidelines.length > 0 ? circle.guidelines : ['']
  );
  const [circleType, setCircleType] = useState(circle.circle_type || 'community');
  const [features, setFeatures] = useState<CircleFeature[]>(normalizeFeatures(circle.enabled_features));
  const [targetAudience, setTargetAudience] = useState(circle.target_audience || '');
  const [memberBenefits, setMemberBenefits] = useState(circle.member_benefits || '');
  const [postingPolicy, setPostingPolicy] = useState(circle.posting_policy || 'creator');
  
  const avatarManager = useFileManager();
  const coverManager = useFileManager();
  
  const avatarFile = avatarManager.files[0]?.file as File | undefined;
  const avatarPreview = avatarManager.files[0]?.url;
  const coverFile = coverManager.files[0]?.file as File | undefined;
  const coverPreview = coverManager.files[0]?.url;

  // Update state when circle data changes or modal opens
  useEffect(() => {
    if (!open) return;
    
    setName(circle.name);
    setDescription(circle.description);
    setAboutSection(circle.about_text || '');
    setGuidelines(circle.guidelines && circle.guidelines.length > 0 ? circle.guidelines : ['']);
    setCircleType(circle.circle_type || 'community');
    setFeatures(normalizeFeatures(circle.enabled_features));
    setTargetAudience(circle.target_audience || '');
    setMemberBenefits(circle.member_benefits || '');
    setPostingPolicy(circle.posting_policy || 'creator');

    // Initialize managers with existing URLs only if they are empty
    if (circle.avatar_url && avatarManager.files.length === 0) {
      avatarManager.setFiles([{
        id: 'existing-avatar',
        file: new File([], 'existing'),
        url: circle.avatar_url,
        status: 'idle',
        kind: 'image',
        name: 'existing',
        size: 0,
        mimeType: 'image/jpeg'
      }]);
    }
    if (circle.cover_image_url && coverManager.files.length === 0) {
      coverManager.setFiles([{
        id: 'existing-cover',
        file: new File([], 'existing'),
        url: circle.cover_image_url,
        status: 'idle',
        kind: 'image',
        name: 'existing',
        size: 0,
        mimeType: 'image/jpeg'
      }]);
    }
    // We only want this to run when the modal is opened or the data fundamentally changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circle.id, open]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cropperImage, setCropperImage] = useState<string | null>(null);
  const [cropperType, setCropperType] = useState<'avatar' | 'cover'>('avatar');

  // Handle file selection from CustomFilePicker for cropping.
  // 'existing-*' entries are the images already saved on the circle and
  // 'cropped-*' entries are crops the user just confirmed — neither may
  // reopen the cropper, otherwise Done/Cancel loops straight back into it.
  useEffect(() => {
    const item = avatarManager.files[0];
    if (item?.file && item.id !== 'existing-avatar' && item.id !== 'cropped-avatar' && !cropperImage) {
      const reader = new FileReader();
      reader.onloadend = () => { setCropperImage(reader.result as string); setCropperType('avatar'); };
      reader.readAsDataURL(item.file);
    }
  }, [avatarManager.files, cropperImage]);

  useEffect(() => {
    const item = coverManager.files[0];
    if (item?.file && item.id !== 'existing-cover' && item.id !== 'cropped-cover' && !cropperImage) {
      const reader = new FileReader();
      reader.onloadend = () => { setCropperImage(reader.result as string); setCropperType('cover'); };
      reader.readAsDataURL(item.file);
    }
  }, [coverManager.files, cropperImage]);
  
  // Removed native handlers in favor of CustomFilePicker managers

  const handleCropComplete = (blob: Blob) => {
    const file = new File([blob], `circle-${cropperType}-${Date.now()}.jpg`, { type: 'image/jpeg' });
    if (cropperType === 'avatar') {
      avatarManager.setFiles([{
        id: 'cropped-avatar',
        file: file,
        url: URL.createObjectURL(blob),
        status: 'idle',
        kind: 'image',
        name: file.name,
        size: file.size,
        mimeType: file.type
      }]);
    } else {
      coverManager.setFiles([{
        id: 'cropped-cover',
        file: file,
        url: URL.createObjectURL(blob),
        status: 'idle',
        kind: 'image',
        name: file.name,
        size: file.size,
        mimeType: file.type
      }]);
    }
    setCropperImage(null);
  };

  // Cancelling a crop must also discard the picked file, otherwise the
  // selection effect above reopens the cropper with the same image.
  const handleCropCancel = () => {
    const manager = cropperType === 'avatar' ? avatarManager : coverManager;
    const existingUrl = cropperType === 'avatar' ? circle.avatar_url : circle.cover_image_url;
    manager.setFiles(existingUrl ? [{
      id: `existing-${cropperType}`,
      file: new File([], 'existing'),
      url: existingUrl,
      status: 'idle',
      kind: 'image',
      name: 'existing',
      size: 0,
      mimeType: 'image/jpeg'
    }] : []);
    setCropperImage(null);
  };

  const addGuideline = () => {
    setGuidelines([...guidelines, '']);
  };

  const updateGuideline = (index: number, value: string) => {
    const newGuidelines = [...guidelines];
    newGuidelines[index] = value;
    setGuidelines(newGuidelines);
  };

  const removeGuideline = (index: number) => {
    setGuidelines(guidelines.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error('You must be logged in');
      return;
    }

    if (!name.trim()) {
      toast.error('Circle name is required');
      return;
    }

    if (!description.trim()) {
      toast.error('Description is required');
      return;
    }

    setIsSubmitting(true);

    try {
      const updates: any = {
        name: name.trim(),
        description: description.trim(),
        about_text: aboutSection.trim() || null,
        guidelines: guidelines.filter(g => g.trim() !== ''),
        circle_type: circleType,
        enabled_features: normalizeFeatures(features),
        target_audience: targetAudience.trim() || null,
        member_benefits: memberBenefits.trim() || null,
        posting_policy: postingPolicy,
      };

      if (avatarFile && avatarFile.size > 0) updates.avatar = avatarFile;
      if (coverFile && coverFile.size > 0) updates.cover = coverFile;

      await updateCircle(circle.id, user.id, updates);
      
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      // Error already handled in mutation
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open && !cropperImage} onOpenChange={(val) => { if (!cropperImage) onOpenChange(val); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Circle</DialogTitle>
            <DialogDescription>
              Update your circle's information, cover image, and community guidelines
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* First Section - Basic Info */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Basic Information</h3>
              
              {/* Cover Image */}
              <div>
                <Label>Cover Image</Label>
                <CustomFilePicker manager={coverManager} hideUploadButton hidePreviewList accept="image/*" maxFileSizeMB={5}>
                  <div 
                    className="mt-2 relative w-full h-32 bg-muted rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                  >
                    {coverPreview ? (
                      <img src={coverPreview} alt="Cover preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Camera className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition-opacity">
                      <Camera className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 text-center font-medium">Click to {coverPreview ? 'change' : 'add'} cover image</p>
                </CustomFilePicker>
              </div>

              {/* Profile Image */}
              <div>
                <Label>Profile Image</Label>
                <CustomFilePicker manager={avatarManager} hideUploadButton hidePreviewList accept="image/*" maxFileSizeMB={5}>
                  <div 
                    className="mt-2 relative w-24 h-24 bg-muted rounded-full overflow-hidden cursor-pointer hover:opacity-80 transition-opacity mx-auto"
                  >
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="Avatar preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary to-accent text-primary-foreground text-2xl font-bold">
                        {name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition-opacity">
                      <Camera className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 text-center font-medium">Click to {avatarPreview ? 'change' : 'add'} profile image</p>
                </CustomFilePicker>
              </div>

              {/* Circle Name */}
              <div>
                <Label htmlFor="name">Circle Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter circle name"
                  className="mt-1"
                  required
                />
              </div>

              {/* Description/Bio */}
              <div>
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your circle..."
                  className="mt-1 min-h-[100px]"
                  required
                />
              </div>
            </div>

            {/* Second Section - Type & Features */}
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-semibold text-lg">Type & Features</h3>

              <div>
                <Label htmlFor="circle-type">Circle Type</Label>
                <select
                  id="circle-type"
                  value={circleType}
                  onChange={(e) => setCircleType(e.target.value)}
                  className="mt-1 w-full p-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  {CIRCLE_TYPES.map((type) => (
                    <option key={type.id} value={type.id}>{type.label}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  The type sets the order of your circle's tabs.
                </p>
              </div>

              <div>
                <Label>Enabled Features</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Only enabled features appear in your circle's navigation.
                </p>
                <div className="mb-4">
                  <Label htmlFor="posting-policy">Who can post?</Label>
                  <select
                    id="posting-policy"
                    value={postingPolicy}
                    onChange={(e) => setPostingPolicy(e.target.value)}
                    className="mt-1 w-full p-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="creator">Creator & admins only</option>
                    <option value="members">All members</option>
                  </select>
                </div>
                <div className="space-y-2">
                  {CIRCLE_FEATURES.map((feature) => {
                    const Icon = feature.icon;
                    const isEnabled = feature.locked || features.includes(feature.id);
                    return (
                      <div key={feature.id} className="flex items-center gap-3 p-2 rounded-lg border border-border">
                        <Icon className={`w-4 h-4 flex-shrink-0 ${isEnabled ? 'text-primary' : 'text-muted-foreground'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">
                            {feature.label}
                            {feature.locked && <span className="ml-2 text-xs text-muted-foreground">Always on</span>}
                          </p>
                        </div>
                        <Switch
                          checked={isEnabled}
                          disabled={feature.locked}
                          onCheckedChange={() =>
                            setFeatures((prev) =>
                              prev.includes(feature.id)
                                ? prev.filter((f) => f !== feature.id)
                                : [...prev, feature.id]
                            )
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Third Section - About & Guidelines */}
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-semibold text-lg">About & Guidelines</h3>

              {/* Audience */}
              <div>
                <Label htmlFor="audience">Who is this circle for?</Label>
                <Input
                  id="audience"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  placeholder="e.g., Beginners who want to learn AI"
                  className="mt-1"
                />
              </div>

              {/* Benefits */}
              <div>
                <Label htmlFor="benefits">What will members receive?</Label>
                <Textarea
                  id="benefits"
                  value={memberBenefits}
                  onChange={(e) => setMemberBenefits(e.target.value)}
                  placeholder="e.g., Weekly live classes, downloadable guides, direct support..."
                  className="mt-1 min-h-[80px]"
                />
              </div>

              {/* About Section */}
              <div>
                <Label htmlFor="about">About This Circle</Label>
                <Textarea
                  id="about"
                  value={aboutSection}
                  onChange={(e) => setAboutSection(e.target.value)}
                  placeholder="Additional information about your circle..."
                  className="mt-1 min-h-[100px]"
                />
              </div>

              {/* Circle Guidelines */}
              <div>
                <Label>Circle Guidelines</Label>
                <div className="space-y-2 mt-2">
                  {guidelines.map((guideline, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        value={guideline}
                        onChange={(e) => updateGuideline(index, e.target.value)}
                        placeholder={`Guideline ${index + 1}`}
                        className="flex-1"
                      />
                      {guidelines.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => removeGuideline(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addGuideline}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Guideline
                  </Button>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {cropperImage && (
        <ImageCropper
          imageSrc={cropperImage}
          aspectRatio={cropperType === 'avatar' ? 1 : 16 / 9}
          cropShape={cropperType === 'avatar' ? 'round' : 'rect'}
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
        />
      )}
    </>
  );
};

export default EditCircleModal;
