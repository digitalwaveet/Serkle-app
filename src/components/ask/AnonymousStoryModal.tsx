import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Pin, Send, Image, Video, Link2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AnonymousStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const STORY_CATEGORIES = [
  { value: 'experience', label: 'Personal Experience' },
  { value: 'advice', label: 'Life Advice' },
  { value: 'confession', label: 'Confession' },
  { value: 'support', label: 'Support Story' },
  { value: 'achievement', label: 'Achievement' },
  { value: 'struggle', label: 'Life Struggle' },
  { value: 'inspiration', label: 'Inspiration' },
  { value: 'lesson', label: 'Life Lesson' }
];

const MOOD_TAGS = [
  'hopeful', 'grateful', 'reflective', 'emotional', 'empowering',
  'vulnerable', 'honest', 'uplifting', 'real-talk', 'healing'
];

export const AnonymousStoryModal: React.FC<AnonymousStoryModalProps> = ({
  isOpen,
  onClose
}) => {
  const [story, setStory] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleTagSelect = (tag: string) => {
    if (!tags.includes(tag) && tags.length < 3) {
      setTags([...tags, tag]);
    }
  };

  const handleTagRemove = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!story.trim()) {
      toast({
        title: "Empty story",
        description: "Please write your story before sharing.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    
    // Simulate API call
    setTimeout(() => {
      toast({
        title: "Story shared anonymously!",
        description: "Your story has been posted and may help others going through similar experiences.",
      });
      
      setStory('');
      setCategory('');
      setTags([]);
      setIsSubmitting(false);
      onClose();
    }, 1500);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md w-[90vw] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pin className="w-5 h-5 text-primary" />
            Share Your Story Anonymously
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Share your experience or advice with the community.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 px-1">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Story Input */}
            <div className="space-y-2">
              <Label htmlFor="story">Your Story</Label>
              <Textarea
                id="story"
                placeholder="Share your experience, journey, or story. Your words might be exactly what someone else needs to hear today..."
                value={story}
                onChange={(e) => setStory(e.target.value)}
                className="min-h-[120px] resize-none"
                required
              />
              <div className="flex justify-between items-center text-xs text-muted-foreground">
                <span>{story.length}/2000 characters</span>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" size="sm" disabled>
                    <Image className="w-4 h-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="sm" disabled>
                    <Video className="w-4 h-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="sm" disabled>
                    <Link2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Category Selection */}
            <div className="space-y-2">
              <Label htmlFor="category">Category (Optional)</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a category to help others find your story" />
                </SelectTrigger>
                <SelectContent>
                  {STORY_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Mood Tags */}
            <div className="space-y-2">
              <Label>Mood & Tone (Optional)</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {MOOD_TAGS.map((tag) => (
                  <Badge
                    key={tag}
                    variant={tags.includes(tag) ? "default" : "outline"}
                    className="cursor-pointer hover:bg-primary/10 text-xs"
                    onClick={() => tags.includes(tag) ? handleTagRemove(tag) : handleTagSelect(tag)}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
              {tags.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  Selected: {tags.join(', ')}
                </div>
              )}
            </div>

            {/* Anonymous Notice */}
            <div className="p-3 bg-gradient-to-r from-primary/5 to-secondary/5 rounded-lg border border-primary/20">
              <h4 className="font-medium text-sm mb-2 text-primary">Anonymous & Safe</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Your identity is completely protected</li>
                <li>• Stories are moderated for safety and respect</li>
                <li>• You can help others while staying anonymous</li>
                <li>• Your story may inspire someone going through similar experiences</li>
              </ul>
            </div>

            {/* Submit Button */}
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-gradient-to-r from-primary to-secondary"
              >
                {isSubmitting ? (
                  <>
                    <SerkleLoader size="xs" className="text-white mr-2" />
                    Sharing...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Share Story
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};