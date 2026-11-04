import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Phone, MapPin, Users, Heart, Shield, Search, AlertTriangle, Volume2, VolumeX, Eye, Share2, Siren, HeartHandshake, UserCheck, Navigation, Plus } from 'lucide-react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { SOSCreationModal } from './SOSCreationModal';
import { MedicalIcon } from '@/components/ui/medical-icon';
import { useNavigation } from '@/contexts/NavigationContext';

export const SOSEmergencyView: React.FC = () => {
  const navigate = useNavigate();
  const { pushModalState } = useNavigation();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedSOSType, setSelectedSOSType] = useState<string>('');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('');
  const [highContrast, setHighContrast] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [locationSharing, setLocationSharing] = useState(false);
  const { triggerHaptic } = useHapticFeedback();

  const sosTypes = [
    {
      id: 'emergency',
      label: 'Emergency',
      icon: Siren,
      urgency: 'critical' as const,
      description: 'For urgent situations outside health or safety.',
      color: 'bg-red-500 hover:bg-red-600',
      gradient: 'from-red-500 to-red-600'
    },
    {
      id: 'lost',
      label: 'Lost Person',
      icon: Search,
      urgency: 'medium' as const,
      description: 'For missing or endangered loved ones.',
      color: 'bg-blue-500 hover:bg-blue-600',
      gradient: 'from-blue-500 to-blue-600'
    },
    {
      id: 'medical',
      label: 'Medical',
      icon: Plus,
      urgency: 'critical' as const,
      description: 'For urgent health-related issues.',
      color: 'bg-card hover:bg-muted/30',
      gradient: 'from-white to-gray-50'
    },
    {
      id: 'safety',
      label: 'Safety',
      icon: Shield,
      urgency: 'high' as const,
      description: 'For threats, danger, or unsafe situations.',
      color: 'bg-yellow-400 hover:bg-yellow-500',
      gradient: 'from-yellow-400 to-yellow-500'
    }
  ];

  const subCategories = {
    medical: [
      {
        id: 'labour-pregnancy',
        label: 'Labour / Pregnancy Emergency',
        description: 'Mom in labour, pregnancy complications, urgent maternity support.'
      },
      {
        id: 'accident-injury',
        label: 'Accident / Injury',
        description: 'Car crash, fall, cuts, burns, broken bones.'
      },
      {
        id: 'sudden-illness',
        label: 'Sudden Illness',
        description: 'Heart attack, stroke, asthma, fever in child, allergic reaction.'
      },
      {
        id: 'other-medical',
        label: 'Other Medical',
        description: 'Any health-related emergency not listed.'
      }
    ],
    lost: [
      {
        id: 'child-missing',
        label: 'Child Missing',
        description: 'Child wandered off, lost in market/mall, suspected abduction.'
      },
      {
        id: 'elderly-missing',
        label: 'Elderly Missing',
        description: 'Elderly family member with memory issues (e.g., dementia).'
      },
      {
        id: 'vulnerable-person',
        label: 'Other Vulnerable Person',
        description: 'Teen runaway, dependent adult, special needs person.'
      },
      {
        id: 'lost-contact',
        label: 'Lost Contact',
        description: 'Family member not reachable for long, last seen update.'
      }
    ],
    safety: [
      {
        id: 'threat-assault',
        label: 'Threat / Assault',
        description: 'Physical attack, harassment, domestic violence.'
      },
      {
        id: 'burglary-robbery',
        label: 'Burglary / Robbery',
        description: 'Break-in at home, stolen property, robbery in progress.'
      },
      {
        id: 'harassment-abuse',
        label: 'Harassment / Abuse',
        description: 'Street harassment, bullying, workplace harassment, abuse reports.'
      },
      {
        id: 'suspicious-activity',
        label: 'Suspicious Activity',
        description: 'Suspicious person, vehicle, or situation in the community.'
      }
    ],
    emergency: [
      {
        id: 'fire',
        label: 'Fire',
        description: 'House fire, wildfire, gas explosion risk.'
      },
      {
        id: 'natural-disaster',
        label: 'Natural Disaster',
        description: 'Earthquake, flood, storm, landslide.'
      },
      {
        id: 'accident-non-medical',
        label: 'Accident (Non-medical)',
        description: 'Car stuck, house collapse, electricity outage causing risk.'
      },
      {
        id: 'miscellaneous-urgent',
        label: 'Miscellaneous Urgent',
        description: 'Any other emergency that doesn\'t fit the above.'
      }
    ]
  };

  const handleSOSPress = (type: string) => {
    const sosType = sosTypes.find(t => t.id === type);
    if (sosType) {
      triggerHaptic('heavy');
      setSelectedSOSType(type);
      pushModalState('sos-creation', () => setShowCreateModal(false));
      setShowCreateModal(true);
    }
  };


  const emergencyContacts = [
    { label: 'Emergency Services', number: '911', icon: Phone, color: 'bg-red-600', iconColor: 'text-white' },
    { label: 'Notify Family', number: 'Family', icon: HeartHandshake, color: 'bg-blue-600', iconColor: 'text-white' }
  ];

  return (
    <div className={`px-2 sm:px-4 space-y-4 sm:space-y-6 ${highContrast ? 'bg-black text-white' : ''}`}>
      {/* Quick SOS Buttons */}
      <Card className={`p-6 ${highContrast ? 'bg-gray-900 border-white' : ''}`}>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          Quick SOS Alert
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {sosTypes.map((type) => {
            const IconComponent = type.icon;
            return (
              <Button
                key={type.id}
                onClick={() => handleSOSPress(type.id)}
                className={`${type.color} ${type.id === 'medical' ? 'text-foreground' : 'text-white'} h-20 flex flex-col items-center justify-center gap-2 font-semibold shadow-2xl transition-all transform active:scale-95 border-0 hover:shadow-[0_0_30px_rgba(239,68,68,0.6)] hover:scale-105 relative overflow-hidden heart-pulse`}
                style={{
                  boxShadow: type.id === 'emergency' 
                    ? '0 0 25px rgba(239, 68, 68, 0.5), 0 8px 32px rgba(0, 0, 0, 0.3)' 
                    : type.id === 'lost'
                    ? '0 0 20px rgba(59, 130, 246, 0.4), 0 8px 32px rgba(0, 0, 0, 0.2)'
                    : type.id === 'medical'
                    ? '0 0 20px rgba(239, 68, 68, 0.3), 0 8px 32px rgba(0, 0, 0, 0.2)'
                    : '0 8px 32px rgba(0, 0, 0, 0.2)'
                }}
                aria-label={`Send ${type.label} SOS alert`}
              >
                <div className={`p-2 rounded-full backdrop-blur-sm shadow-lg ${type.id === 'medical' ? 'bg-red-500' : 'bg-card/30'}`}>
                  <IconComponent className={`h-6 w-6 ${type.id === 'medical' ? 'text-white stroke-[3]' : ''}`} />
                </div>
                <span className="text-xs font-bold">{type.label}</span>
              </Button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-3 text-center">
          ⚠️ Only use for real emergencies
        </p>
      </Card>

      {/* Accessibility Controls */}
      <Card className={`p-4 ${highContrast ? 'bg-gray-900 border-white' : ''}`}>
        <h3 className="font-medium mb-3 flex items-center gap-2">
          <Eye className="h-4 w-4 text-blue-500" />
          Accessibility
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">High Contrast</span>
            </div>
            <Switch
              checked={highContrast}
              onCheckedChange={setHighContrast}
              aria-label="Toggle high contrast mode"
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {soundEnabled ? <Volume2 className="h-4 w-4 text-muted-foreground" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
              <span className="text-sm">Sound & Vibration</span>
            </div>
            <Switch
              checked={soundEnabled}
              onCheckedChange={setSoundEnabled}
              aria-label="Toggle sound and vibration"
              className="data-[state=checked]:bg-green-500"
            />
          </div>
        </div>
      </Card>

      {/* Emergency Contacts */}
      <Card className={`p-4 ${highContrast ? 'bg-gray-900 border-white' : ''}`}>
        <h3 className="font-medium mb-3 flex items-center gap-2">
          <Phone className="h-4 w-4" />
          Emergency Contacts
        </h3>
        <div className="space-y-2">
          {emergencyContacts.map((contact, index) => (
            <Button
              key={index}
              variant="outline"
              className="w-full justify-start h-12"
              onClick={() => {
                triggerHaptic('medium');
                if (contact.number === '911') {
                  window.open(`tel:${contact.number}`, '_self');
                } else {
                  alert(`Notifying ${contact.label}...`);
                }
              }}
            >
              <div className={`${contact.color} p-2 rounded-lg shadow-sm`}>
                <contact.icon className={`h-5 w-5 ${contact.iconColor}`} />
              </div>
              <div className="text-left">
                <p className="font-medium text-sm">{contact.label}</p>
                <p className="text-xs text-muted-foreground">{contact.number}</p>
              </div>
            </Button>
          ))}
        </div>
      </Card>

      {/* Location Sharing */}
      <Card className={`p-4 ${highContrast ? 'bg-gray-900 border-white' : ''}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Navigation className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-medium text-sm">Location Sharing</h3>
              <p className="text-xs text-muted-foreground">
                {locationSharing ? 'Sharing within 1 mile radius' : 'Location sharing disabled'}
              </p>
            </div>
          </div>
          <Switch
            checked={locationSharing}
            onCheckedChange={setLocationSharing}
            aria-label="Toggle location sharing"
            className="data-[state=checked]:bg-green-500"
          />
        </div>
        {locationSharing && (
          <div className="mt-3 flex items-center gap-2">
            <Badge variant="outline" className="text-xs bg-green-50 border-green-200 text-green-700">
              <Siren className="h-3 w-3 mr-1" />
              Live Location Active
            </Badge>
          </div>
        )}
      </Card>

      {/* SOS Creation Modal */}
      <SOSCreationModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        sosType={selectedSOSType}
        subCategory={selectedSubCategory}
      />
    </div>
  );
};