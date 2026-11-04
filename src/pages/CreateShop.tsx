import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { ArrowLeft, Camera, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useShopItemMutations } from '../hooks/useShopItemMutations';
import { useSellerProfile } from '../hooks/useSellerProfile';
import { toast } from 'sonner';
import { validateImageFiles } from '../utils/shopImageUpload';
import { SellerOnboardingModal } from '../components/shop/SellerOnboardingModal';
import { CustomFilePicker, useFileManager } from '../components/CustomFilePicker';

const CreateShop: React.FC = () => {
  const navigate = useNavigate();
  const { createItem } = useShopItemMutations();
  const { profile, isLoading: profileLoading } = useSellerProfile();
  const [showOnboarding, setShowOnboarding] = useState(false);
  
  const [productName, setProductName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('1');
  const [category, setCategory] = useState('electronics');
  const [condition, setCondition] = useState<'new' | 'used' | 'refurbished'>('new');
  const [brand, setBrand] = useState('');
  const [location, setLocation] = useState('');
  const imageManager = useFileManager();
  const selectedImages = imageManager.files.map(f => f.file).filter(Boolean) as File[];
  const imagePreviews = imageManager.files.map(f => f.url);

  // Check if user needs to complete seller onboarding
  useEffect(() => {
    if (!profileLoading && !profile) {
      setShowOnboarding(true);
    }
  }, [profile, profileLoading]);

  // handleImageSelect and handleRemoveImage are now handled by imageManager and CustomFilePicker components

  const handleCreate = async () => {
    if (!profile) {
      toast.error('Please set up your seller profile first');
      return;
    }

    if (!productName || !price || !location || selectedImages.length === 0) {
      toast.error('Please fill in all required fields and add at least one image');
      return;
    }

    createItem.mutate({
      title: productName,
      description,
      price: parseFloat(price),
      category,
      condition,
      brand: brand || undefined,
      location,
      stock: parseInt(stock),
      images: selectedImages
    }, {
      onSuccess: () => {
        navigate('/shop');
      }
    });
  };

  const categories = ['electronics', 'fashion', 'home', 'food', 'art'];
  const conditions = [
    { value: 'new', label: 'New', description: 'Brand new, unused' },
    { value: 'used', label: 'Used', description: 'Previously owned' },
    { value: 'refurbished', label: 'Refurbished', description: 'Restored' }
  ];

  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="flex items-center justify-between p-4">
          <button onClick={() => navigate(-1)} className="flex items-center text-muted-foreground">
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back
          </button>
          <h1 className="text-lg font-semibold">List Item</h1>
          <Button
            onClick={handleCreate}
            className="px-6"
            disabled={createItem.isPending || !profile}
          >
            {createItem.isPending ? (
              <>
                <SerkleLoader size="xs" className="text-current mr-2" />
                Listing...
              </>
            ) : (
              'List'
            )}
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="bg-muted/30 p-4 rounded-lg">
          <Label>Product Photos (Required - Max 5)</Label>
          <div className="mt-2">
            <CustomFilePicker
              manager={imageManager}
              multiple
              maxFiles={5}
              accept="image/*"
              hideUploadButton
            >
              <div className="aspect-square w-24 rounded-lg border-2 border-dashed border-border bg-background flex items-center justify-center hover:border-primary transition-colors cursor-pointer">
                <Camera className="h-6 w-6 text-muted-foreground" />
              </div>
            </CustomFilePicker>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {selectedImages.length}/5 images
          </p>
        </div>

        <div>
          <Label htmlFor="productName">Product Name *</Label>
          <Input
            id="productName"
            placeholder="e.g., iPhone 13 Pro Max"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            className="mt-1"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="price">Price *</Label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id="price"
                type="number"
                placeholder="0.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="pl-7"
                min="0"
                step="0.01"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="stock">Stock</Label>
            <Input
              id="stock"
              type="number"
              placeholder="1"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              className="mt-1"
              min="1"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="brand">Brand</Label>
          <Input
            id="brand"
            placeholder="e.g., Apple, Samsung"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className="mt-1"
          />
        </div>

        <div>
          <Label>Category *</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-4 py-2 rounded-full transition-colors ${
                  category === cat
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80'
                }`}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label>Condition *</Label>
          <div className="mt-2 space-y-2">
            {conditions.map((cond) => (
              <button
                key={cond.value}
                onClick={() => setCondition(cond.value as 'new' | 'used' | 'refurbished')}
                className={`w-full p-3 rounded-lg border text-left transition-colors ${
                  condition === cond.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <p className="font-medium">{cond.label}</p>
                <p className="text-xs text-muted-foreground">{cond.description}</p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="description">Description *</Label>
          <Textarea
            id="description"
            placeholder="Describe your product..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 min-h-[120px]"
          />
        </div>

        <div>
          <Label htmlFor="location">Location *</Label>
          <Input 
            id="location"
            placeholder="City or area" 
            className="mt-1"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>

        {!profile && !profileLoading && (
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              Please set up your seller profile first.
            </p>
          </div>
        )}
      </div>

      <SellerOnboardingModal 
        isOpen={showOnboarding} 
        onClose={() => {
          setShowOnboarding(false);
          if (!profile) {
            navigate('/shop');
          }
        }} 
      />
    </div>
  );
};

export default CreateShop;
