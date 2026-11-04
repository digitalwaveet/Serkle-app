import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Shield, Heart, CheckCircle } from 'lucide-react';
import { useHelperProfile } from '@/hooks/useHelperProfile';
import { useUser } from '@/contexts/UserContext';
import { toast } from 'sonner';

const HELPER_SKILLS = [
  'First Aid Certified',
  'CPR Certified',
  'Medical Professional',
  'Emergency Responder',
  'Local Guide',
  'Translator',
  'Vehicle Available',
  'Tools Available',
];

interface HelperOnboardingProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

export const HelperOnboarding: React.FC<HelperOnboardingProps> = ({ open, onOpenChange, onComplete }) => {
  const { user } = useUser();
  const { upsertProfile } = useHelperProfile(user?.id);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [step, setStep] = useState(1);

  const toggleSkill = (skill: string) => {
    setSelectedSkills(prev =>
      prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
    );
  };

  const handleComplete = async () => {
    if (!agreedToTerms) {
      toast.error('Please agree to the terms to continue');
      return;
    }

    try {
      await upsertProfile.mutateAsync({
        skills: selectedSkills,
        availability_status: 'available',
        is_available: true,
      });
      
      toast.success('Welcome to the helper community!');
      onComplete?.();
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to complete registration');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Shield className="h-6 w-6 text-blue-500" />
            Become a Helper
          </DialogTitle>
          <DialogDescription>
            Join our community of helpers and make a difference in emergency situations
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Step Indicator */}
          <div className="flex items-center gap-2">
            <div className={`h-2 flex-1 rounded-full ${step >= 1 ? 'bg-blue-500' : 'bg-gray-200'}`} />
            <div className={`h-2 flex-1 rounded-full ${step >= 2 ? 'bg-blue-500' : 'bg-gray-200'}`} />
            <div className={`h-2 flex-1 rounded-full ${step >= 3 ? 'bg-blue-500' : 'bg-gray-200'}`} />
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h3 className="font-medium text-blue-900 mb-2">What is a Helper?</h3>
                <ul className="space-y-2 text-sm text-blue-800">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>Respond to nearby emergencies and offer assistance</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>Build your reputation and earn badges</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>Make a real difference in your community</span>
                  </li>
                </ul>
              </div>
              <Button onClick={() => setStep(2)} className="w-full">
                Continue
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-medium mb-3">Select Your Skills & Certifications</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Choose skills that you can offer during emergencies
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {HELPER_SKILLS.map((skill) => (
                    <button
                      key={skill}
                      onClick={() => toggleSkill(skill)}
                      className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                        selectedSkills.includes(skill)
                          ? 'bg-blue-100 text-blue-800 border-blue-300 shadow-sm'
                          : 'bg-card border-border text-muted-foreground hover:bg-muted/30'
                      }`}
                    >
                      {skill}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                  Back
                </Button>
                <Button onClick={() => setStep(3)} className="flex-1">
                  Next
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                <h3 className="font-medium text-amber-900 mb-2 flex items-center gap-2">
                  <Heart className="h-4 w-4" />
                  Helper Guidelines
                </h3>
                <ul className="space-y-2 text-sm text-amber-800">
                  <li>• Always prioritize your own safety first</li>
                  <li>• Respond only to situations you're qualified to handle</li>
                  <li>• Maintain respectful communication at all times</li>
                  <li>• Call professional emergency services (911) when needed</li>
                  <li>• Keep your location and availability status updated</li>
                </ul>
              </div>

              <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg border">
                <Checkbox
                  id="terms"
                  checked={agreedToTerms}
                  onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
                />
                <label htmlFor="terms" className="text-sm cursor-pointer">
                  I understand and agree to follow the helper guidelines and terms of service
                </label>
              </div>

              {selectedSkills.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Selected Skills:</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedSkills.map(skill => (
                      <Badge key={skill} variant="secondary">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                  Back
                </Button>
                <Button 
                  onClick={handleComplete} 
                  disabled={!agreedToTerms || upsertProfile.isPending}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {upsertProfile.isPending ? 'Setting up...' : 'Become a Helper'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
