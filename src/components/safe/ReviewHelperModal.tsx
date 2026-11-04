import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Star } from 'lucide-react';
import { useSOSReviews } from '@/hooks/useSOSReviews';

interface ReviewHelperModalProps {
  isOpen: boolean;
  onClose: () => void;
  alertId: string;
  helperUserId: string;
  helperName: string;
}

export const ReviewHelperModal: React.FC<ReviewHelperModalProps> = ({
  isOpen,
  onClose,
  alertId,
  helperUserId,
  helperName,
}) => {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  
  const { createReview } = useSOSReviews();

  const handleSubmit = async () => {
    if (rating === 0) {
      return;
    }

    await createReview.mutateAsync({
      alert_id: alertId,
      helper_user_id: helperUserId,
      rating,
      review_text: reviewText || undefined,
    });

    onClose();
    setRating(0);
    setReviewText('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Review Helper</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              How was your experience with {helperName}?
            </p>
            
            {/* Star Rating */}
            <div className="flex justify-center gap-2 mb-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    className={`h-8 w-8 ${
                      star <= (hoverRating || rating)
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-gray-300'
                    }`}
                  />
                </button>
              ))}
            </div>
            
            {rating > 0 && (
              <p className="text-sm font-medium">
                {rating === 1 && 'Poor'}
                {rating === 2 && 'Fair'}
                {rating === 3 && 'Good'}
                {rating === 4 && 'Very Good'}
                {rating === 5 && 'Excellent'}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Share your experience (optional)
            </label>
            <Textarea
              placeholder="Tell us more about your experience..."
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={rating === 0 || createReview.isPending}
              className="flex-1 bg-primary"
            >
              {createReview.isPending ? 'Submitting...' : 'Submit Review'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
