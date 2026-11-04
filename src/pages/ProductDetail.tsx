import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, Share2, Star, MessageCircle, MapPin, Shield, Truck, RotateCcw, Flag, Plus, Minus, Send, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import FooterNav from '@/components/FooterNav';
import { useCart } from '@/contexts/CartContext';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { useShopItems } from '@/hooks/useShopItems';
import { useProductReviews } from '@/hooks/useProductReviews';
import { useReviewMutations } from '@/hooks/useReviewMutations';
import { useShopMessageMutations } from '@/hooks/useShopMessages';

import { supabase } from '@/integrations/supabase/client';
import { CustomFilePicker, useFileManager } from '@/components/CustomFilePicker';

const reviewSchema = z.object({
  rating: z.number().min(1, { message: "Please select a rating" }).max(5),
  comment: z.string().trim().min(10, { message: "Comment must be at least 10 characters" }).max(1000, { message: "Comment must be less than 1000 characters" })
});

import { type TabKey } from '@/hooks/useAppNav';

const ProductDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { toast } = useToast();
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [isFavorited, setIsFavorited] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const reviewFileManager = useFileManager();
  const [uploadingImages, setUploadingImages] = useState(false);
  const [reviewErrors, setReviewErrors] = useState<{ rating?: string; comment?: string }>({});
  const [showReviewInput, setShowReviewInput] = useState(false);
  const [activeTab, setActiveTab] = useState('description');

  const { data: items, isLoading } = useShopItems({});
  const { data: reviews = [], isLoading: reviewsLoading } = useProductReviews(id || '');
  const { createReview } = useReviewMutations();
  const { createConversation } = useShopMessageMutations();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <SerkleLoader size="md" className="text-primary" />
      </div>
    );
  }

  // Find the product
  const product = items?.find(p => p.id === id);

  if (!product) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Product not found</h2>
          <Button onClick={() => navigate('/shop')}>Back to Shop</Button>
        </div>
      </div>
    );
  }

  // Calculate average rating
  const averageRating = reviews.length > 0 
    ? reviews.reduce((acc, review) => acc + review.rating, 0) / reviews.length 
    : 0;
  const ratingCounts = [5, 4, 3, 2, 1].map(rating => 
    reviews.filter(review => review.rating === rating).length
  );

  // Get similar products
  const similarProducts = (items || [])
    .filter(p => p.id !== product.id && p.category === product.category)
    .slice(0, 4);

  const handleAddToCart = () => {
    addToCart(product, quantity);
    
    toast({
      title: "Added to cart",
      description: `${quantity}x ${product.name} added to your cart`,
    });
  };

  const handleBuyNow = () => {
    handleAddToCart();
    navigate('/cart');
  };

  const handleContactSeller = async () => {
    if (!product) return;
    try {
      const conversationId = await createConversation.mutateAsync({
        itemId: product.id,
        sellerId: product.seller.id,
      });
      navigate(`/shop/messages/${conversationId}`);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleReviewImageUpload = async (file: File | Blob, meta: any) => {
    const fileName = `${Date.now()}-${meta.name}`;
    const { data, error } = await supabase.storage
      .from('review-images')
      .upload(fileName, file);
    
    if (error) throw error;
    
    const { data: { publicUrl } } = supabase.storage
      .from('review-images')
      .getPublicUrl(fileName);
    
    return publicUrl;
  };

  const handleSubmitReview = async () => {
    try {
      setReviewErrors({});
      
      const validatedData = reviewSchema.parse({
        rating: reviewRating,
        comment: reviewComment
      });
      
      // Use images already uploaded via CustomFilePicker
      const imageUrls = reviewFileManager.files
        .filter(f => f.status === 'done' && f.result)
        .map(f => f.result as string);
        
      setUploadingImages(reviewFileManager.files.some(f => f.status === 'uploading'));
      if (uploadingImages) {
        toast({
          title: "Wait a moment",
          description: "Photos are still uploading...",
        });
        return;
      }
      
      // Submit review
      await createReview.mutateAsync({
        itemId: id!,
        rating: validatedData.rating,
        comment: validatedData.comment,
        images: imageUrls
      });
      
      // Reset form
      setReviewRating(0);
      setReviewComment('');
      reviewFileManager.clearAll();
      setShowReviewInput(false);
      
    } catch (error) {
      setUploadingImages(false);
      if (error instanceof z.ZodError) {
        const errors: { rating?: string; comment?: string } = {};
        error.errors.forEach((err) => {
          if (err.path[0] === 'rating') {
            errors.rating = err.message;
          } else if (err.path[0] === 'comment') {
            errors.comment = err.message;
          }
        });
        setReviewErrors(errors);
      }
    }
  };

  const renderStars = (rating: number, size: 'sm' | 'md' = 'md') => {
    const sizeClass = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${sizeClass} ${
              star <= rating
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b">
        <div className="flex items-center justify-between p-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/shop')}
            className="p-2"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsFavorited(!isFavorited)}
              className="p-2"
            >
              <Heart className={`w-5 h-5 ${isFavorited ? 'fill-red-500 text-red-500' : ''}`} />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="p-2 active:bg-transparent active:text-primary"
              onClick={() => {
                if (navigator.share) {
                  navigator.share({ title: product.name, text: product.description, url: window.location.href }).catch(() => {});
                } else {
                  navigator.clipboard.writeText(window.location.href);
                  toast({ title: 'Link copied to clipboard' });
                }
              }}
            >
              <Share2 className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="sm" className="p-2">
              <Flag className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Product Images */}
      <div className="relative">
        <div className="aspect-[4/3] bg-muted max-h-80">
          <img
            src={product.images?.[selectedImageIndex] || product.image}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        </div>
        
        {/* Image thumbnails */}
        {product.images && product.images.length > 1 && (
          <div className="flex gap-2 p-4 overflow-x-auto scrollbar-hide">
            {product.images.map((image, index) => (
              <button
                key={index}
                onClick={() => setSelectedImageIndex(index)}
                className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                  selectedImageIndex === index ? 'border-primary' : 'border-muted'
                }`}
              >
                <img src={image} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="p-4 space-y-4">
        {/* Title and Price */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant={product.condition === 'new' ? 'default' : 'secondary'}>
              {product.condition}
            </Badge>
            <Badge variant="outline">{product.category}</Badge>
          </div>
          
          <h1 className="text-lg font-bold text-foreground mb-2 line-clamp-2">{product.name}</h1>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-primary">${product.price}</span>
              {product.originalPrice && (
                <span className="text-lg text-muted-foreground line-through">
                  ${product.originalPrice}
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-1">
              {renderStars(averageRating)}
              <span className="text-sm text-muted-foreground ml-1">
                ({reviews.length} reviews)
              </span>
            </div>
          </div>
        </div>

        {/* Seller Info */}
        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate(`/seller/${product.seller.id}`)}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Avatar className="flex-shrink-0">
                <AvatarImage src={product.seller.avatar} />
                <AvatarFallback>{product.seller.name[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium text-sm truncate">{product.seller.name}</h3>
                  {product.seller.verified && (
                    <Badge variant="outline" className="text-xs flex-shrink-0">
                      <Shield className="w-3 h-3 mr-1" />
                      Verified
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  {renderStars(product.seller.rating, 'sm')}
                  <span className="truncate">({product.seller.reviews})</span>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-shrink-0 text-xs px-2"
                onClick={(e) => {
                  e.stopPropagation();
                  handleContactSeller();
                }}
                disabled={createConversation.isPending}
              >
                {createConversation.isPending ? (
                  <SerkleLoader size="xs" className="text-current" />
                ) : (
                  <>
                    <MessageCircle className="w-3 h-3 sm:mr-1" />
                    <span className="hidden sm:inline">Message</span>
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Product Details Tabs */}
        <Tabs defaultValue="description" className="w-full" onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="description">Description</TabsTrigger>
            <TabsTrigger value="reviews">Reviews</TabsTrigger>
            <TabsTrigger value="similar">Similar</TabsTrigger>
          </TabsList>
          
          <TabsContent value="description" className="mt-4 space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Description</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {product.description}
              </p>
            </div>
            
            <Separator />
            
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Details</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Condition:</span>
                  <span className="font-medium capitalize">{product.condition}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Category:</span>
                  <span className="font-medium">{product.category}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Brand:</span>
                  <span className="font-medium">{product.brand || 'Generic'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Location:</span>
                  <span className="font-medium flex items-center">
                    <MapPin className="w-3 h-3 mr-1" />
                    {product.location}
                  </span>
                </div>
              </div>
            </div>
            
            <Separator />
            
            <div className="space-y-2">
              <h3 className="font-semibold text-sm">Shipping & Returns</h3>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <Truck className="w-3 h-3 text-primary" />
                  <span>Free shipping on orders over $50</span>
                </div>
                <div className="flex items-center gap-2">
                  <RotateCcw className="w-3 h-3 text-primary" />
                  <span>30-day return policy</span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="w-3 h-3 text-primary" />
                  <span>Buyer protection guaranteed</span>
                </div>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="reviews" className="mt-4 space-y-4">
            {/* Rating Summary */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold">{averageRating.toFixed(1)}</div>
                    <div className="flex items-center justify-center mb-1">
                      {renderStars(Math.round(averageRating))}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {reviews.length} reviews
                    </div>
                  </div>
                  
                  <div className="flex-1 space-y-1">
                    {[5, 4, 3, 2, 1].map((rating, index) => (
                      <div key={rating} className="flex items-center gap-2 text-xs">
                        <span>{rating}</span>
                        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                        <div className="flex-1 bg-muted rounded-full h-2">
                          <div
                            className="bg-yellow-400 h-2 rounded-full"
                            style={{
                              width: `${reviews.length > 0 ? (ratingCounts[index] / reviews.length) * 100 : 0}%`
                            }}
                          />
                        </div>
                        <span className="text-muted-foreground">
                          {ratingCounts[index]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Individual Reviews */}
            <div className="space-y-4">
              {reviewsLoading ? (
                <div className="flex justify-center py-8">
                  <SerkleLoader size="sm" className="text-primary" />
                </div>
              ) : reviews.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <p className="text-muted-foreground">No reviews yet. Be the first to review!</p>
                  </CardContent>
                </Card>
              ) : (
                reviews.map((review) => (
                <Card key={review.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={review.user.avatar} />
                        <AvatarFallback>{review.user.name[0]}</AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{review.user.name}</span>
                          {review.user.verified && (
                            <Badge variant="outline" className="text-xs">
                              Verified
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2 mb-2">
                          {renderStars(review.rating, 'sm')}
                          <span className="text-xs text-muted-foreground">
                            {review.timestamp}
                          </span>
                        </div>
                        
                        <p className="text-sm text-muted-foreground mb-2">
                          {review.comment}
                        </p>
                        
                        {review.images && (
                          <div className="flex gap-2 mb-2">
                            {review.images.map((image, index) => (
                              <img
                                key={index}
                                src={image}
                                alt=""
                                className="w-16 h-16 rounded object-cover"
                              />
                            ))}
                          </div>
                        )}
                        
                         <Button variant="ghost" size="sm" className="text-xs h-6 px-2">
                           👍 Helpful ({review.helpful})
                         </Button>
                       </div>
                     </div>
                   </CardContent>
                  </Card>
                ))
              )}
            </div>
             
             {/* Add Review Section */}
             {showReviewInput && (
               <Card className="mt-6 sticky bottom-24 z-10">
                 <CardContent className="p-4">
                   <div className="flex items-center justify-between mb-4">
                     <h3 className="font-semibold text-sm">Write a Review</h3>
                     <Button 
                       variant="ghost" 
                       size="sm" 
                       onClick={() => setShowReviewInput(false)}
                       className="text-muted-foreground hover:text-foreground"
                     >
                       ✕
                     </Button>
                   </div>
                   
                   {/* Rating Selector */}
                   <div className="mb-4">
                     <label className="block text-sm font-medium mb-2">Rating</label>
                     <div className="flex items-center gap-1">
                       {[1, 2, 3, 4, 5].map((star) => (
                         <button
                           key={star}
                           type="button"
                           onClick={() => setReviewRating(star)}
                           className="p-1 transition-colors"
                         >
                           <Star
                             className={`w-6 h-6 ${
                               star <= reviewRating
                                 ? 'fill-yellow-400 text-yellow-400'
                                 : 'text-gray-300 hover:text-yellow-300'
                             }`}
                           />
                         </button>
                       ))}
                     </div>
                     {reviewErrors.rating && (
                       <p className="text-red-500 text-xs mt-1">{reviewErrors.rating}</p>
                     )}
                   </div>
                   
                   {/* Comment Input */}
                   <div className="mb-4">
                     <label className="block text-sm font-medium mb-2">Comment</label>
                     <Textarea
                       placeholder="Share your experience with this product..."
                       value={reviewComment}
                       onChange={(e) => setReviewComment(e.target.value)}
                       className="min-h-[80px] resize-none"
                       maxLength={1000}
                     />
                     <div className="flex justify-between items-center mt-1">
                       <span className="text-xs text-muted-foreground">
                         {reviewComment.length}/1000 characters
                       </span>
                       {reviewErrors.comment && (
                         <p className="text-red-500 text-xs">{reviewErrors.comment}</p>
                       )}
                     </div>
                    </div>
                    
                    {/* Image Upload */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-2">
                        Photos (Optional)
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <CustomFilePicker
                          manager={reviewFileManager}
                          onUpload={handleReviewImageUpload}
                          multiple
                          maxFiles={5}
                          accept="image/*"
                          hideUploadButton
                        >
                          <div className="w-20 h-20 border-2 border-dashed border-border rounded-lg flex items-center justify-center cursor-pointer hover:border-primary transition-colors">
                            <Upload className="w-6 h-6 text-muted-foreground" />
                          </div>
                        </CustomFilePicker>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Add up to 5 photos to help others
                      </p>
                    </div>
                    
                    {/* Submit Button */}
                    <Button 
                      onClick={handleSubmitReview}
                      className="w-full"
                      size="sm"
                      disabled={!reviewRating || !reviewComment.trim() || uploadingImages}
                    >
                      {uploadingImages ? (
                        <>
                          <SerkleLoader size="xs" className="text-current mr-2" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          Submit Review
                        </>
                      )}
                    </Button>
                 </CardContent>
               </Card>
             )}
           </TabsContent>
          
          <TabsContent value="similar" className="mt-4">
            <div className="grid grid-cols-2 gap-3">
              {similarProducts.map((item) => (
                <Card 
                  key={item.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => navigate(`/shop/product/${item.id}`)}
                >
                  <CardContent className="p-2">
                    <div className="aspect-square bg-muted rounded-lg mb-2 overflow-hidden">
                      <img 
                        src={item.image} 
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <h4 className="font-medium text-xs line-clamp-2 mb-1 leading-tight">
                      {item.name}
                    </h4>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-primary">${item.price}</span>
                      <div className="flex items-center gap-1">
                        {renderStars(item.rating, 'sm')}
                        <span className="text-[10px] text-muted-foreground">
                          ({item.reviews})
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Floating Write Review Button */}
      {!showReviewInput && activeTab === 'reviews' && (
        <div className="fixed bottom-36 right-4 z-20">
          <Button
            onClick={() => setShowReviewInput(true)}
            className="rounded-full shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground"
            size="sm"
          >
            <Star className="w-4 h-4 mr-2 fill-current" />
            Write Review
          </Button>
        </div>
      )}

      {/* Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t px-6 py-4 pb-20">
        <div className="flex items-center gap-2 max-w-md mx-auto">
          {/* Quantity Selector */}
          <div className="flex items-center border rounded-lg">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="h-8 w-8 p-0"
            >
              <Minus className="w-3 h-3" />
            </Button>
            <span className="px-2 py-1 min-w-[30px] text-center text-sm">{quantity}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setQuantity(quantity + 1)}
              className="h-8 w-8 p-0"
            >
              <Plus className="w-3 h-3" />
            </Button>
          </div>
          
          {/* Action Buttons */}
          <Button 
            variant="outline" 
            size="sm"
            className="flex-1"
            onClick={handleAddToCart}
          >
            Add to Cart
          </Button>
          <Button 
            size="sm"
            className="flex-1 bg-gradient-to-r from-primary to-secondary"
            onClick={handleBuyNow}
          >
            Buy Now
          </Button>
        </div>
      </div>

      <FooterNav 
        active="home"
        onSelect={() => {}}
        onOpenCreate={() => {}}
      />
    </div>
  );
};

export default ProductDetail;