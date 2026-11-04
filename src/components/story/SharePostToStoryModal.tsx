import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useState, useEffect } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { VideoLoader } from '@/components/ui/VideoLoader';
import { useUser } from '@/contexts/UserContext';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import StoryEditor from '@/components/story/StoryEditor';
import { Post } from '@/data/mock';
import { storyService } from '@/services/storyService';

interface SharePostToStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  post: Post;
}

const SharePostToStoryModal: React.FC<SharePostToStoryModalProps> = ({ isOpen, onClose, post }) => {
  const { user } = useUser();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [backgroundUrl, setBackgroundUrl] = useState<string>('');
  const [postCardUrl, setPostCardUrl] = useState<string>('');

  // Generate a background from the post image (blurred) or a sleek dark gradient
  const generateBackgroundUrl = async (): Promise<string> => {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    let drawGradient = true;

    if (post.media?.url) {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = post.media!.url;
        });

        // Fill background with dark color first
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, 1080, 1920);

        // Apply strong blur and darken for background
        ctx.filter = 'blur(60px) brightness(0.6)';
        
        // Calculate cover dimensions
        const scale = Math.max(1080 / img.width, 1920 / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        const x = (1080 - w) / 2;
        const y = (1920 - h) / 2;
        
        ctx.drawImage(img, x, y, w, h);
        ctx.filter = 'none';

        // Add a subtle dark overlay to ensure the post card pops
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(0, 0, 1080, 1920);
        
        drawGradient = false;
      } catch (e) {
        console.error('Failed to load post image for background:', e);
      }
    }

    if (drawGradient) {
      // Sleek dark gradient fallback instead of the brown one
      const grad = ctx.createLinearGradient(0, 0, 1080, 1920);
      grad.addColorStop(0, '#1e293b'); // slate-800
      grad.addColorStop(1, '#0f172a'); // slate-900
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1080, 1920);
    }

    // App watermark
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '500 28px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Shared from Serkle', 540, 1850);

    return canvas.toDataURL('image/jpeg', 0.8);
  };

  // Generate a post card image that looks like the actual post (high DPI)
  const generatePostCardImage = async (): Promise<string> => {
    // Render at 3x scale for high quality
    const scale = 3;
    const cardWidth = 340;
    const padding = 16;
    const avatarSize = 44;
    const isVideo = post.media?.url && /\.(mp4|webm|mov|ogg|m3u8)(\?|$)/i.test(post.media.url);
    const mediaImageUrl = isVideo ? post.thumbnailUrl : post.media?.url;
    const imageHeight = mediaImageUrl ? 220 : 0;
    const textLineHeight = 24;
    const maxTextLines = 5;
    
    // Calculate text height
    const textContent = post.content || '';
    const words = textContent.split(' ');
    let lines: string[] = [];
    let currentLine = '';
    const maxCharsPerLine = 38;
    
    for (const word of words) {
      if ((currentLine + word).length > maxCharsPerLine) {
        if (currentLine) lines.push(currentLine.trim());
        currentLine = word + ' ';
      } else {
        currentLine += word + ' ';
      }
    }
    if (currentLine.trim()) lines.push(currentLine.trim());
    
    // Limit lines
    if (lines.length > maxTextLines) {
      lines = lines.slice(0, maxTextLines);
      lines[maxTextLines - 1] = lines[maxTextLines - 1].slice(0, -3) + '...';
    }
    
    const textHeight = lines.length * textLineHeight;
    const cardHeight = padding + avatarSize + 14 + imageHeight + (imageHeight > 0 ? 14 : 0) + textHeight + padding;
    
    const canvas = document.createElement('canvas');
    // Set canvas to 3x resolution
    canvas.width = cardWidth * scale;
    canvas.height = cardHeight * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    
    // Scale all drawing operations
    ctx.scale(scale, scale);
    
    // Enable high quality rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Card background with rounded corners and shadow
    const radius = 20;
    
    // Draw shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 4;
    
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(radius, 0);
    ctx.lineTo(cardWidth - radius, 0);
    ctx.quadraticCurveTo(cardWidth, 0, cardWidth, radius);
    ctx.lineTo(cardWidth, cardHeight - radius);
    ctx.quadraticCurveTo(cardWidth, cardHeight, cardWidth - radius, cardHeight);
    ctx.lineTo(radius, cardHeight);
    ctx.quadraticCurveTo(0, cardHeight, 0, cardHeight - radius);
    ctx.lineTo(0, radius);
    ctx.quadraticCurveTo(0, 0, radius, 0);
    ctx.closePath();
    ctx.fill();
    
    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    
    let yOffset = padding;
    
    // Avatar - try to load image first, fallback to initials
    const avatarX = padding + avatarSize / 2;
    const avatarY = yOffset + avatarSize / 2;
    
    if (post.user.avatar) {
      try {
        const avatarImg = new Image();
        avatarImg.crossOrigin = 'anonymous';
        await new Promise((resolve, reject) => {
          avatarImg.onload = resolve;
          avatarImg.onerror = reject;
          avatarImg.src = post.user.avatar!;
        });
        
        // Draw circular avatar image
        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX, avatarY, avatarSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatarImg, padding, yOffset, avatarSize, avatarSize);
        ctx.restore();
      } catch (e) {
        // Fallback to initials circle
        ctx.beginPath();
        ctx.arc(avatarX, avatarY, avatarSize / 2, 0, Math.PI * 2);
        ctx.fillStyle = post.user.avatarColor || '#4B164C';
        ctx.fill();
        
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(post.user.initials || '??', avatarX, avatarY);
      }
    } else {
      // Draw initials circle
      ctx.beginPath();
      ctx.arc(avatarX, avatarY, avatarSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = post.user.avatarColor || '#4B164C';
      ctx.fill();
      
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(post.user.initials || '??', avatarX, avatarY);
    }
    
    // Username
    ctx.fillStyle = '#1F2937';
    ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(post.user.name || 'User', padding + avatarSize + 12, avatarY);
    
    yOffset += avatarSize + 14;
    
    // Post image if exists
    if (mediaImageUrl) {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = mediaImageUrl;
        });
        
        // Draw image with rounded corners
        const imgX = padding;
        const imgY = yOffset;
        const imgWidth = cardWidth - padding * 2;
        const imgRadius = 14;
        
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(imgX + imgRadius, imgY);
        ctx.lineTo(imgX + imgWidth - imgRadius, imgY);
        ctx.quadraticCurveTo(imgX + imgWidth, imgY, imgX + imgWidth, imgY + imgRadius);
        ctx.lineTo(imgX + imgWidth, imgY + imageHeight - imgRadius);
        ctx.quadraticCurveTo(imgX + imgWidth, imgY + imageHeight, imgX + imgWidth - imgRadius, imgY + imageHeight);
        ctx.lineTo(imgX + imgRadius, imgY + imageHeight);
        ctx.quadraticCurveTo(imgX, imgY + imageHeight, imgX, imgY + imageHeight - imgRadius);
        ctx.lineTo(imgX, imgY + imgRadius);
        ctx.quadraticCurveTo(imgX, imgY, imgX + imgRadius, imgY);
        ctx.closePath();
        ctx.clip();
        
        // Scale and center the image (cover fit)
        const imgScale = Math.max(imgWidth / img.width, imageHeight / img.height);
        const drawWidth = img.width * imgScale;
        const drawHeight = img.height * imgScale;
        const drawX = imgX + (imgWidth - drawWidth) / 2;
        const drawY = imgY + (imageHeight - drawHeight) / 2;
        
        ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
        ctx.restore();
        
        yOffset += imageHeight + 14;
      } catch (e) {
        console.error('Failed to load post image:', e);
        yOffset += 14;
      }
    }
    
    // Post text
    ctx.fillStyle = '#374151';
    ctx.font = '15px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    
    for (const line of lines) {
      ctx.fillText(line, padding, yOffset);
      yOffset += textLineHeight;
    }
    
    return canvas.toDataURL('image/png', 1.0);
  };

  const isVideo = post.media?.url ? /\.(mp4|webm|mov|ogg|m3u8)(\?|$)/i.test(post.media.url) : false;

  // Generate background and post card, then show editor
  useEffect(() => {
    if (isOpen && !backgroundUrl) {
      if (isVideo && post.media?.url) {
        generatePostCardImage().then((cardUrl) => {
          setBackgroundUrl(post.media!.url);
          setPostCardUrl(cardUrl);
          setShowEditor(true);
        });
      } else {
        Promise.all([
          generateBackgroundUrl(),
          generatePostCardImage()
        ]).then(([bgUrl, cardUrl]) => {
          setBackgroundUrl(bgUrl);
          setPostCardUrl(cardUrl);
          setShowEditor(true);
        });
      }
    }
  }, [isOpen, backgroundUrl]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setShowEditor(false);
      setBackgroundUrl('');
      setPostCardUrl('');
      setUploadDone(false);
      setIsUploading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleEditorDone = async (editedBlob: Blob, mentionedUserIds?: string[], extraData?: any) => {
    if (!user) return;
    setShowEditor(false);
    setIsUploading(true);
    setUploadDone(false);

    try {
      const isVideoStory = extraData?.mediaType === 'video';
      await storyService.createStory(user.id, editedBlob, isVideoStory, mentionedUserIds, {
        ...extraData,
        reshared_post_id: String(post.id)
      });

      setIsUploading(false);
      setUploadDone(true);
      
      // Show success for 1.5s then close
      setTimeout(() => {
        toast({ title: "Shared to story!", description: "Post has been added to your story." });
        onClose();
      }, 1500);
    } catch (error) {
      console.error('Share to story error:', error);
      toast({ title: "Failed to share", description: "Please try again.", variant: "destructive" });
      setIsUploading(false);
      onClose();
    }
  };

  // Upload / success animation overlay
  if (isUploading || uploadDone) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
        {isUploading && (
          <div className="flex flex-col items-center gap-4 animate-fade-in">
            <div className="relative">
              <SerkleLoader size="md" dark label="Uploading story" />
            </div>
            <p className="text-white text-lg font-medium">Sharing to story...</p>
            <p className="text-white/60 text-sm">Uploading your post</p>
          </div>
        )}
        {uploadDone && (
          <div className="flex flex-col items-center gap-4 animate-scale-in">
            <div className="size-20 rounded-full bg-green-500 flex items-center justify-center">
              <CheckCircle2 className="size-10 text-white" />
            </div>
            <p className="text-white text-lg font-medium">Shared!</p>
            <p className="text-white/60 text-sm">Your story is now live</p>
          </div>
        )}
      </div>
    );
  }

  // Pass the post card image URL to the editor
  const initialPostElements = postCardUrl ? {
    postCardImageUrl: postCardUrl,
  } : undefined;

  // Show loading state while preparing editor
  if (!showEditor || !backgroundUrl || !postCardUrl) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
        <VideoLoader size="lg" dark />
        <p className="text-white/80 mt-6 font-medium">Preparing story...</p>
      </div>
    );
  }

  return (
    <StoryEditor
      previewUrl={backgroundUrl}
      mediaType={isVideo ? 'video' : 'image'}
      initialPostElements={initialPostElements}
      resharedPostId={String(post.id)}
      onDone={handleEditorDone}
      onCancel={onClose}
    />
  );
};

export default SharePostToStoryModal;
