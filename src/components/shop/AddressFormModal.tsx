import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useAddressMutations, ShippingAddress } from '@/hooks/useShippingAddresses';


interface AddressFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingAddress?: Partial<ShippingAddress> | null;
}

export const AddressFormModal: React.FC<AddressFormModalProps> = ({
  isOpen,
  onClose,
  editingAddress,
}) => {
  const { createAddress, updateAddress } = useAddressMutations();
  const [formData, setFormData] = useState({
    full_name: '',
    street: '',
    city: '',
    state: '',
    zip_code: '',
    country: 'United States',
    phone: '',
    is_default: false,
  });

  useEffect(() => {
    if (editingAddress) {
      setFormData({
        full_name: editingAddress.full_name || '',
        street: editingAddress.street || '',
        city: editingAddress.city || '',
        state: editingAddress.state || '',
        zip_code: editingAddress.zip_code || '',
        country: editingAddress.country || 'United States',
        phone: editingAddress.phone || '',
        is_default: editingAddress.is_default || false,
      });
    } else {
      setFormData({
        full_name: '',
        street: '',
        city: '',
        state: '',
        zip_code: '',
        country: 'United States',
        phone: '',
        is_default: false,
      });
    }
  }, [editingAddress, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingAddress?.id) {
        await updateAddress.mutateAsync({
          id: editingAddress.id,
          ...formData,
        });
      } else {
        await createAddress.mutateAsync(formData);
      }
      onClose();
    } catch (error) {
      // Error handled by mutation
    }
  };

  const isLoading = createAddress.isPending || updateAddress.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingAddress ? 'Edit Address' : 'Add Shipping Address'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="full_name">Full Name</Label>
            <Input
              id="full_name"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="street">Street Address</Label>
            <Input
              id="street"
              value={formData.street}
              onChange={(e) => setFormData({ ...formData, street: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="zip_code">ZIP Code</Label>
              <Input
                id="zip_code"
                value={formData.zip_code}
                onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              required
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="is_default"
              checked={formData.is_default}
              onCheckedChange={(checked) => 
                setFormData({ ...formData, is_default: checked as boolean })
              }
            />
            <Label htmlFor="is_default" className="font-normal">
              Set as default address
            </Label>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <SerkleLoader size="xs" className="text-current mr-2" />
                  Saving...
                </>
              ) : editingAddress ? (
                'Update'
              ) : (
                'Add Address'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
