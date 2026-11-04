import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Heart, Shield, Search, Siren, Baby, Bandage, Stethoscope, Home, Eye, UserX, Flame, Cloud, Car, User, Phone, Cross } from 'lucide-react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { SOSCreationModal } from '@/components/safe/SOSCreationModal';
import FooterNav from '@/components/FooterNav';
import { useNavigation } from '@/contexts/NavigationContext';
import { type TabKey } from '@/hooks/useAppNav';

export const SOSSubCategories: React.FC = () => {
  const { category } = useParams<{ category: string }>();
  const navigate = useNavigate();
  const { pushModalState } = useNavigation();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('');
  const { triggerHaptic } = useHapticFeedback();

  const sosTypes = {
    medical: {
      icon: Heart,
      label: 'Medical Emergency',
      color: 'bg-card',
      gradient: 'from-white to-gray-50',
      description: 'For urgent health-related issues.',
      bgGradient: 'from-gray-50 to-gray-100',
      borderColor: 'border-border'
    },
    safety: {
      icon: Shield,
      label: 'Safety Alert',
      color: 'bg-yellow-400',
      gradient: 'from-yellow-400 to-yellow-500',
      description: 'For threats, danger, or unsafe situations.',
      bgGradient: 'from-yellow-50 to-yellow-100',
      borderColor: 'border-yellow-300'
    },
    lost: {
      icon: Search,
      label: 'Lost Person',
      color: 'bg-blue-500',
      gradient: 'from-blue-500 to-blue-600',
      description: 'For missing or endangered loved ones.',
      bgGradient: 'from-blue-50 to-blue-100',
      borderColor: 'border-blue-200'
    },
    emergency: {
      icon: Siren,
      label: 'General Emergency',
      color: 'bg-red-500',
      gradient: 'from-red-500 to-red-600',
      description: 'For urgent situations outside health or safety.',
      bgGradient: 'from-red-50 to-red-100',
      borderColor: 'border-red-200'
    }
  };

  const subCategories = {
    medical: [
      {
        id: 'labour-pregnancy',
        label: 'Labour / Pregnancy Emergency',
        description: 'Mom in labour, pregnancy complications, urgent maternity support.',
        icon: Baby,
        color: 'bg-red-500',
        borderColor: 'border-border'
      },
      {
        id: 'accident-injury',
        label: 'Accident / Injury',
        description: 'Car crash, fall, cuts, burns, broken bones.',
        icon: Bandage,
        color: 'bg-red-500',
        borderColor: 'border-border'
      },
      {
        id: 'sudden-illness',
        label: 'Sudden Illness',
        description: 'Heart attack, stroke, asthma, fever in child, allergic reaction.',
        icon: Cross,
        color: 'bg-red-500',
        borderColor: 'border-border'
      },
      {
        id: 'other-medical',
        label: 'Other Medical',
        description: 'Any health-related emergency not listed.',
        icon: Stethoscope,
        color: 'bg-red-500',
        borderColor: 'border-border'
      }
    ],
    lost: [
      {
        id: 'child-missing',
        label: 'Child Missing',
        description: 'Child wandered off, lost in market/mall, suspected abduction.',
        icon: Baby,
        color: 'bg-blue-500',
        borderColor: 'border-blue-200'
      },
      {
        id: 'elderly-missing',
        label: 'Elderly Missing',
        description: 'Elderly family member with memory issues (e.g., dementia).',
        icon: User,
        color: 'bg-blue-500',
        borderColor: 'border-blue-200'
      },
      {
        id: 'vulnerable-person',
        label: 'Other Vulnerable Person',
        description: 'Teen runaway, dependent adult, special needs person.',
        icon: Heart,
        color: 'bg-blue-500',
        borderColor: 'border-blue-200'
      },
      {
        id: 'lost-contact',
        label: 'Lost Contact',
        description: 'Family member not reachable for long, last seen update.',
        icon: Phone,
        color: 'bg-blue-500',
        borderColor: 'border-blue-200'
      }
    ],
    safety: [
      {
        id: 'threat-assault',
        label: 'Threat / Assault',
        description: 'Physical attack, harassment, domestic violence.',
        icon: Shield,
        color: 'bg-yellow-400',
        borderColor: 'border-yellow-300'
      },
      {
        id: 'burglary-robbery',
        label: 'Burglary / Robbery',
        description: 'Break-in at home, stolen property, robbery in progress.',
        icon: Home,
        color: 'bg-yellow-400',
        borderColor: 'border-yellow-300'
      },
      {
        id: 'harassment-abuse',
        label: 'Harassment / Abuse',
        description: 'Street harassment, bullying, workplace harassment, abuse reports.',
        icon: UserX,
        color: 'bg-yellow-400',
        borderColor: 'border-yellow-300'
      },
      {
        id: 'suspicious-activity',
        label: 'Suspicious Activity',
        description: 'Suspicious person, vehicle, or situation in the community.',
        icon: Eye,
        color: 'bg-yellow-400',
        borderColor: 'border-yellow-300'
      }
    ],
    emergency: [
      {
        id: 'fire',
        label: 'Fire',
        description: 'House fire, wildfire, gas explosion risk.',
        icon: Flame,
        color: 'bg-red-500',
        borderColor: 'border-red-200'
      },
      {
        id: 'natural-disaster',
        label: 'Natural Disaster',
        description: 'Earthquake, flood, storm, landslide.',
        icon: Cloud,
        color: 'bg-red-500',
        borderColor: 'border-red-200'
      },
      {
        id: 'accident-non-medical',
        label: 'Accident (Non-medical)',
        description: 'Car stuck, house collapse, electricity outage causing risk.',
        icon: Car,
        color: 'bg-red-500',
        borderColor: 'border-red-200'
      },
      {
        id: 'miscellaneous-urgent',
        label: 'Miscellaneous Urgent',
        description: 'Any other emergency that doesn\'t fit the above.',
        icon: Siren,
        color: 'bg-red-500',
        borderColor: 'border-red-200'
      }
    ]
  };

  const currentType = category ? sosTypes[category as keyof typeof sosTypes] : null;
  const currentSubCategories = category ? subCategories[category as keyof typeof subCategories] : [];

  if (!currentType || !category) {
    navigate('/');
    return null;
  }

  const IconComponent = currentType.icon;

  const handleSubCategoryPress = (subCategoryId: string) => {
    triggerHaptic('heavy');
    setSelectedSubCategory(subCategoryId);
    pushModalState('sos-creation', () => setShowCreateModal(false));
    setShowCreateModal(true);
  };

  const handleBack = () => {
    triggerHaptic('light');
    navigate(-1);
  };

  return (
    <div className="min-h-[100dvh] mx-auto bg-background text-foreground max-w-[480px] relative border-l border-r border-border">
      {/* Header with category branding */}
      <div className={`bg-gradient-to-r ${currentType.bgGradient} ${currentType.borderColor} border-b`}>
        <div className="px-4 py-6">
          <div className="flex items-center gap-3 mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="p-2 hover:bg-card/20"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className={`p-3 ${currentType.color} rounded-xl shadow-lg border border-border`}>
              <IconComponent className="h-6 w-6 text-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">{currentType.label}</h1>
              <p className="text-sm text-muted-foreground">{currentType.description}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Subcategories List */}
      <div className="px-4 py-6 space-y-4">
        <div className="text-center mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-2">Select Emergency Type</h2>
          <p className="text-sm text-muted-foreground">Choose the option that best describes your situation</p>
        </div>

        <div className="space-y-3">
          {currentSubCategories.map((subCategory) => {
            const SubIcon = subCategory.icon;
            return (
              <Card
                key={subCategory.id}
                className={`p-4 cursor-pointer transition-all hover:shadow-md active:scale-[0.98] ${subCategory.borderColor} border-2 hover:border-opacity-60`}
                onClick={() => handleSubCategoryPress(subCategory.id)}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 ${subCategory.color} rounded-lg shadow-sm`}>
                        <SubIcon className="h-4 w-4 text-white stroke-[3]" />
                      </div>
                      <h3 className="font-semibold text-foreground text-sm">
                        {subCategory.label}
                      </h3>
                    </div>
                    <div className={`w-3 h-3 ${subCategory.color} rounded-full`} />
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed ml-11">
                    {subCategory.description}
                  </p>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Emergency Call Button */}
        <Card className="p-4 bg-red-50 border-red-200 border-2 mt-8">
          <Button
            variant="outline"
            className="w-full text-red-600 hover:text-red-700 border-red-200 hover:bg-red-100 h-12"
            onClick={() => {
              triggerHaptic('heavy');
              window.open('tel:911', '_self');
            }}
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">911</span>
              </div>
              <span className="font-semibold">Call Emergency Services</span>
            </div>
          </Button>
        </Card>
      </div>

      {/* SOS Creation Modal */}
      <SOSCreationModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        sosType={category}
        subCategory={selectedSubCategory}
      />

      <FooterNav
        active="safe"
        onSelect={() => { }} // Navigation handled by FooterNav directly
        onOpenCreate={() => { }}
      />
    </div>
  );
};