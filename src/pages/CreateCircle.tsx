import React, { useState } from 'react';
import { ArrowLeft, Camera, Globe, Lock, Crown, MapPin, Wifi, Check, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { useCircleMutations } from '@/hooks/useCircleMutations';
import { useUser } from '@/contexts/UserContext';
import { toast } from 'sonner';
import InviteLinkModal from '@/components/circles/InviteLinkModal';
import { CustomFilePicker, useFileManager } from '@/components/CustomFilePicker';
import {
  CIRCLE_TYPES,
  CIRCLE_FEATURES,
  CIRCLE_CATEGORIES,
  getCircleType,
  type CircleFeature,
  type CircleTypeId,
} from '@/lib/circleTypes';

const LANGUAGES = [
  'English',
  'Arabic',
  'Spanish',
  'French',
  'German',
  'Portuguese',
  'Hindi',
  'Chinese',
  'Other',
];

const STEP_TITLES = ['Circle type', 'Basics', 'Access & pricing', 'Features'];
const TOTAL_STEPS = STEP_TITLES.length;

const CreateCircle: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const { createCircle, isCreating } = useCircleMutations();

  const [step, setStep] = useState(1);

  // Step 1 — type
  const [circleType, setCircleType] = useState<CircleTypeId | null>(null);

  // Step 2 — basics
  const [circleName, setCircleName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [memberBenefits, setMemberBenefits] = useState('');

  // Step 3 — access & pricing
  const [privacy, setPrivacy] = useState<'public' | 'private'>('public');
  const [pricing, setPricing] = useState<'free' | 'paid'>('free');
  const [price, setPrice] = useState('10');
  const [isOnline, setIsOnline] = useState(true);
  const [location, setLocation] = useState('');
  const [language, setLanguage] = useState('English');

  // Step 4 — features
  const [features, setFeatures] = useState<CircleFeature[]>([]);
  const [postingPolicy, setPostingPolicy] = useState<'creator' | 'members'>('creator');

  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [createdCircle, setCreatedCircle] = useState<{ id: string; invite_code: string; name: string } | null>(null);

  const circleManager = useFileManager();
  const avatarFile = circleManager.files[0]?.file as File | undefined;
  const avatarPreview = circleManager.files[0]?.url;

  const clearError = (key: string) => {
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: false }));
  };

  const handleSelectType = (typeId: CircleTypeId) => {
    setCircleType(typeId);
    // Each type comes with its own recommended feature set
    setFeatures(getCircleType(typeId).defaultFeatures);
  };

  const toggleFeature = (featureId: CircleFeature) => {
    setFeatures((prev) =>
      prev.includes(featureId) ? prev.filter((f) => f !== featureId) : [...prev, featureId]
    );
  };

  const validateStep = (): boolean => {
    if (step === 1) {
      if (!circleType) {
        toast.error('Choose what type of circle you are creating');
        return false;
      }
      return true;
    }

    if (step === 2) {
      const newErrors = {
        name: !circleName.trim(),
        description: !description.trim(),
        category: !category,
      };
      setErrors(newErrors);
      if (newErrors.name || newErrors.description || newErrors.category) {
        toast.error('Please fill in all required fields');
        return false;
      }
      return true;
    }

    if (step === 3) {
      const priceValue = parseFloat(price);
      const newErrors = {
        price: pricing === 'paid' && (!price || isNaN(priceValue) || priceValue <= 0),
        location: !isOnline && !location.trim(),
      };
      setErrors(newErrors);
      if (newErrors.price) {
        toast.error('Enter a valid subscription price');
        return false;
      }
      if (newErrors.location) {
        toast.error('Add a location for your local circle');
        return false;
      }
      return true;
    }

    return true;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((s) => s - 1);
    } else {
      navigate('/');
    }
  };

  const handleCreate = async () => {
    if (!user) {
      toast.error('You must be logged in to create a circle');
      return;
    }
    if (!validateStep() || !circleType) return;

    try {
      const circle = await createCircle(
        {
          name: circleName,
          description,
          category,
          location: location || undefined,
          is_private: privacy === 'private',
          avatar: avatarFile || undefined,
          circle_type: circleType,
          enabled_features: ['posts', ...features.filter((f) => f !== 'posts')],
          target_audience: targetAudience.trim() || null,
          member_benefits: memberBenefits.trim() || null,
          primary_language: language,
          is_online: isOnline,
          posting_policy: postingPolicy,
          subscription_enabled: pricing === 'paid',
          subscription_price: pricing === 'paid' ? parseFloat(price) : undefined,
        },
        user.id
      );

      if (privacy === 'private' && circle.invite_code) {
        setCreatedCircle({ id: circle.id, invite_code: circle.invite_code, name: circleName });
        setShowInviteModal(true);
      } else {
        navigate(`/circle/${circle.id}`);
      }
    } catch (error) {
      // Error already handled in mutation
    }
  };

  const selectedType = circleType ? getCircleType(circleType) : null;

  return (
    <div className="min-h-[100dvh] bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between p-4">
          <button
            onClick={handleBack}
            className="flex items-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back
          </button>
          <div className="text-center">
            <h1 className="text-lg font-semibold">Create Circle</h1>
            <p className="text-xs text-muted-foreground">
              Step {step} of {TOTAL_STEPS} · {STEP_TITLES[step - 1]}
            </p>
          </div>
          <div className="w-16" />
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-6 pb-32 max-w-[480px] mx-auto">
        {/* ── Step 1: Circle type ─────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <h2 className="font-semibold text-foreground">What type of circle are you creating?</h2>
              <p className="text-sm text-muted-foreground">
                Your choice shapes the layout and features of your circle. You can adjust everything later.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {CIRCLE_TYPES.map((type) => {
                const Icon = type.icon;
                const isSelected = circleType === type.id;
                return (
                  <button
                    key={type.id}
                    onClick={() => handleSelectType(type.id)}
                    className={`relative flex flex-col items-start gap-2 p-4 rounded-lg border text-left transition-colors ${
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    {isSelected && (
                      <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-3 h-3 text-primary-foreground" />
                      </span>
                    )}
                    <Icon className={`w-6 h-6 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                    <div>
                      <p className={`font-medium text-sm ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                        {type.label}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{type.tagline}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Step 2: Basics ──────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-6 animate-fade-in">
            <div className="text-center">
              <CustomFilePicker manager={circleManager} hideUploadButton hidePreviewList accept="image/*" maxFileSizeMB={5}>
                <div className="w-24 h-24 mx-auto rounded-full bg-muted border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors group overflow-hidden">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Circle avatar" className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
                  )}
                </div>
              </CustomFilePicker>
              <p className="text-sm text-muted-foreground mt-2">
                {avatarPreview ? 'Change circle photo' : 'Add circle photo (optional)'}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="circle-name">Circle Name <span className="text-destructive">*</span></Label>
              <Input
                id="circle-name"
                placeholder="Enter circle name"
                value={circleName}
                onChange={(e) => { setCircleName(e.target.value); clearError('name'); }}
                className={errors.name ? 'border-destructive focus-visible:ring-destructive' : ''}
              />
              {errors.name && <p className="text-xs text-destructive">Circle name is required</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description <span className="text-destructive">*</span></Label>
              <Textarea
                id="description"
                placeholder="Describe what your circle is about..."
                value={description}
                onChange={(e) => { setDescription(e.target.value); clearError('description'); }}
                className={`min-h-[100px] ${errors.description ? 'border-destructive focus-visible:ring-destructive' : ''}`}
              />
              {errors.description && <p className="text-xs text-destructive">Description is required</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category <span className="text-destructive">*</span></Label>
              <select
                id="category"
                value={category}
                onChange={(e) => { setCategory(e.target.value); clearError('category'); }}
                className={`w-full p-2 border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${errors.category ? 'border-destructive' : 'border-border'}`}
              >
                <option value="">Select a category</option>
                {CIRCLE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              {errors.category && <p className="text-xs text-destructive">Please select a category</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="audience">Who is this circle for? (Optional)</Label>
              <Input
                id="audience"
                placeholder="e.g., Beginners who want to learn AI"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="benefits">What will members receive? (Optional)</Label>
              <Textarea
                id="benefits"
                placeholder="e.g., Weekly live classes, downloadable guides, direct support..."
                value={memberBenefits}
                onChange={(e) => setMemberBenefits(e.target.value)}
                className="min-h-[80px]"
              />
            </div>
          </div>
        )}

        {/* ── Step 3: Access & pricing ────────────────────────── */}
        {step === 3 && (
          <div className="space-y-6 animate-fade-in">
            <div className="space-y-2">
              <Label>Privacy</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setPrivacy('public')}
                  className={`flex items-center space-x-2 p-3 rounded-lg border transition-colors ${
                    privacy === 'public'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <Globe className="w-5 h-5" />
                  <div className="text-left">
                    <p className="font-medium">Public</p>
                    <p className="text-xs text-muted-foreground">Anyone can join</p>
                  </div>
                </button>
                <button
                  onClick={() => setPrivacy('private')}
                  className={`flex items-center space-x-2 p-3 rounded-lg border transition-colors ${
                    privacy === 'private'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <Lock className="w-5 h-5" />
                  <div className="text-left">
                    <p className="font-medium">Private</p>
                    <p className="text-xs text-muted-foreground">Invite only</p>
                  </div>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Membership</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setPricing('free')}
                  className={`flex items-center space-x-2 p-3 rounded-lg border transition-colors ${
                    pricing === 'free'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <Check className="w-5 h-5" />
                  <div className="text-left">
                    <p className="font-medium">Free</p>
                    <p className="text-xs text-muted-foreground">Open to all members</p>
                  </div>
                </button>
                <button
                  onClick={() => setPricing('paid')}
                  className={`flex items-center space-x-2 p-3 rounded-lg border transition-colors ${
                    pricing === 'paid'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <Crown className="w-5 h-5" />
                  <div className="text-left">
                    <p className="font-medium">Paid</p>
                    <p className="text-xs text-muted-foreground">Monthly subscription</p>
                  </div>
                </button>
              </div>
              {pricing === 'paid' && (
                <div className="space-y-2 pt-2">
                  <Label htmlFor="price">Monthly price (coins) <span className="text-destructive">*</span></Label>
                  <Input
                    id="price"
                    type="number"
                    min="1"
                    placeholder="10"
                    value={price}
                    onChange={(e) => { setPrice(e.target.value); clearError('price'); }}
                    className={errors.price ? 'border-destructive focus-visible:ring-destructive' : ''}
                  />
                  {errors.price && <p className="text-xs text-destructive">Enter a valid price</p>}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Where does your circle meet?</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setIsOnline(true)}
                  className={`flex items-center space-x-2 p-3 rounded-lg border transition-colors ${
                    isOnline
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <Wifi className="w-5 h-5" />
                  <div className="text-left">
                    <p className="font-medium">Online</p>
                    <p className="text-xs text-muted-foreground">Members from anywhere</p>
                  </div>
                </button>
                <button
                  onClick={() => setIsOnline(false)}
                  className={`flex items-center space-x-2 p-3 rounded-lg border transition-colors ${
                    !isOnline
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <MapPin className="w-5 h-5" />
                  <div className="text-left">
                    <p className="font-medium">Local</p>
                    <p className="text-xs text-muted-foreground">Meets in person</p>
                  </div>
                </button>
              </div>
              <div className="space-y-2 pt-2">
                <Label htmlFor="location">
                  Location {!isOnline ? <span className="text-destructive">*</span> : '(Optional)'}
                </Label>
                <Input
                  id="location"
                  placeholder="e.g., San Francisco, CA"
                  value={location}
                  onChange={(e) => { setLocation(e.target.value); clearError('location'); }}
                  className={errors.location ? 'border-destructive focus-visible:ring-destructive' : ''}
                />
                {errors.location && <p className="text-xs text-destructive">Location is required for local circles</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="language">Primary language</Label>
              <select
                id="language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full p-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* ── Step 4: Features ────────────────────────────────── */}
        {step === 4 && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <h2 className="font-semibold text-foreground">Choose your circle's features</h2>
              <p className="text-sm text-muted-foreground">
                {selectedType
                  ? `We pre-selected what works best for a ${selectedType.label} circle. Only enabled features appear in your circle.`
                  : 'Only enabled features appear in your circle.'}
              </p>
            </div>
            <div className="space-y-3">
              {CIRCLE_FEATURES.map((feature) => {
                const Icon = feature.icon;
                const isEnabled = feature.locked || features.includes(feature.id);
                return (
                  <Card key={feature.id} className={isEnabled ? 'border-primary/40' : ''}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <Icon className={`w-5 h-5 flex-shrink-0 ${isEnabled ? 'text-primary' : 'text-muted-foreground'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-foreground">
                            {feature.label}
                            {feature.locked && (
                              <span className="ml-2 text-xs text-muted-foreground">Always on</span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">{feature.description}</p>
                        </div>
                        <Switch
                          checked={isEnabled}
                          disabled={feature.locked}
                          onCheckedChange={() => toggleFeature(feature.id)}
                        />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="space-y-2 pt-2">
              <Label>Who can post?</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setPostingPolicy('creator')}
                  className={`flex items-center space-x-2 p-3 rounded-lg border transition-colors ${
                    postingPolicy === 'creator'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <Crown className="w-5 h-5" />
                  <div className="text-left">
                    <p className="font-medium">Creator only</p>
                    <p className="text-xs text-muted-foreground">You & admins post</p>
                  </div>
                </button>
                <button
                  onClick={() => setPostingPolicy('members')}
                  className={`flex items-center space-x-2 p-3 rounded-lg border transition-colors ${
                    postingPolicy === 'members'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <Users className="w-5 h-5" />
                  <div className="text-left">
                    <p className="font-medium">All members</p>
                    <p className="text-xs text-muted-foreground">Everyone can post</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border safe-area-bottom">
        <div className="max-w-[480px] mx-auto p-4">
          {step < TOTAL_STEPS ? (
            <Button onClick={handleNext} className="w-full" disabled={step === 1 && !circleType}>
              Continue
            </Button>
          ) : (
            <Button onClick={handleCreate} className="w-full" disabled={isCreating}>
              {isCreating ? 'Creating...' : 'Create Circle'}
            </Button>
          )}
        </div>
      </div>

      {createdCircle && (
        <InviteLinkModal
          open={showInviteModal}
          onOpenChange={(open) => {
            setShowInviteModal(open);
            if (!open) navigate(`/circle/${createdCircle.id}`);
          }}
          inviteCode={createdCircle.invite_code}
          circleName={createdCircle.name}
        />
      )}
    </div>
  );
};

export default CreateCircle;
