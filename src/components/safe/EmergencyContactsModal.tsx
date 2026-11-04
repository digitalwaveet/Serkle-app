import React, { useState } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Phone, UserPlus, Trash2, Star } from 'lucide-react';
import { useEmergencyContacts } from '@/hooks/useEmergencyContacts';
import { Switch } from '@/components/ui/switch';
import { useIsMobile } from '@/hooks/use-mobile';

interface EmergencyContactsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EmergencyContactsModal: React.FC<EmergencyContactsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [relationship, setRelationship] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const isMobile = useIsMobile();

  const { contacts, isLoading, createContact, deleteContact } = useEmergencyContacts();

  const handleAdd = async () => {
    if (!contactName || !contactPhone) return;

    await createContact.mutateAsync({
      contact_name: contactName,
      contact_phone: contactPhone,
      relationship: relationship || undefined,
      is_primary: isPrimary,
    });

    // Reset form
    setContactName('');
    setContactPhone('');
    setRelationship('');
    setIsPrimary(false);
    setIsAdding(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to remove this contact?')) {
      deleteContact.mutate(id);
    }
  };

  return (
    <Drawer open={isOpen} onOpenChange={onClose}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader>
          <DrawerTitle>Emergency Contacts</DrawerTitle>
        </DrawerHeader>

        <div className="overflow-y-auto px-4 pb-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            These contacts will be notified when you create an SOS alert
          </p>

          {/* Add Contact Form */}
          {isAdding ? (
            <Card className="p-3 space-y-3 border-primary">
              <div className="space-y-2">
                <Label htmlFor="contact-name" className="text-sm">Name *</Label>
                <Input
                  id="contact-name"
                  placeholder="John Doe"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact-phone" className="text-sm">Phone Number *</Label>
                <Input
                  id="contact-phone"
                  type="tel"
                  placeholder="+1 (555) 123-4567"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="relationship" className="text-sm">Relationship</Label>
                <Input
                  id="relationship"
                  placeholder="e.g., Spouse, Parent, Friend"
                  value={relationship}
                  onChange={(e) => setRelationship(e.target.value)}
                  className="h-10"
                />
              </div>

              <div className="flex items-center justify-between py-1">
                <Label htmlFor="is-primary" className="text-sm">Primary Contact</Label>
                <Switch
                  id="is-primary"
                  checked={isPrimary}
                  onCheckedChange={setIsPrimary}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsAdding(false);
                    setContactName('');
                    setContactPhone('');
                    setRelationship('');
                    setIsPrimary(false);
                  }}
                  className="flex-1 touch-target"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAdd}
                  disabled={!contactName || !contactPhone || createContact.isPending}
                  className="flex-1 touch-target"
                >
                  {createContact.isPending ? 'Adding...' : 'Add'}
                </Button>
              </div>
            </Card>
          ) : (
            <Button
              onClick={() => setIsAdding(true)}
              className="w-full touch-target"
              variant="outline"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Add Emergency Contact
            </Button>
          )}

          {/* Contacts List */}
          <div className="space-y-2">
            {isLoading ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Loading contacts...
              </p>
            ) : contacts && contacts.length > 0 ? (
              contacts.map((contact) => (
                <Card key={contact.id} className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-sm truncate">{contact.contact_name}</h4>
                        {contact.is_primary && (
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400 shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Phone className="h-3 w-3 shrink-0" />
                        <span className="truncate">{contact.contact_phone}</span>
                      </div>
                      {contact.relationship && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {contact.relationship}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(contact.id)}
                      className="text-destructive hover:text-destructive shrink-0 touch-target"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No emergency contacts added yet
              </p>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
