import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Edit, Trash2, MapPin, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useShippingAddresses, useAddressMutations } from '@/hooks/useShippingAddresses';

import FooterNav from '@/components/FooterNav';
import { AddressFormModal } from '@/components/shop/AddressFormModal';

const ShippingAddresses: React.FC = () => {
  const navigate = useNavigate();
  const { data: addresses, isLoading } = useShippingAddresses();
  const { deleteAddress, setDefaultAddress } = useAddressMutations();
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState<any>(null);

  const handleDelete = async (addressId: string) => {
    if (confirm('Are you sure you want to delete this address?')) {
      await deleteAddress.mutateAsync(addressId);
    }
  };

  const handleSetDefault = async (addressId: string) => {
    await setDefaultAddress.mutateAsync(addressId);
  };

  const handleEdit = (address: any) => {
    setEditingAddress(address);
    setShowAddressForm(true);
  };

  const handleCloseModal = () => {
    setShowAddressForm(false);
    setEditingAddress(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <SerkleLoader size="md" className="text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/shop')}
              className="p-2"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-lg font-semibold">Shipping Addresses</h1>
          </div>
          <Button
            size="sm"
            onClick={() => setShowAddressForm(true)}
          >
            <Plus className="w-4 h-4 mr-1" />
            Add
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {!addresses || addresses.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <MapPin className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-semibold mb-2">No Addresses Saved</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Add a shipping address for faster checkout
              </p>
              <Button onClick={() => setShowAddressForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Address
              </Button>
            </CardContent>
          </Card>
        ) : (
          addresses.map((address) => (
            <Card key={address.id} className="relative">
              <CardContent className="p-4">
                {address.is_default && (
                  <Badge className="absolute top-3 right-3 bg-success text-success-foreground">
                    <Check className="w-3 h-3 mr-1" />
                    Default
                  </Badge>
                )}

                <div className="space-y-2 mb-4">
                  <p className="font-semibold">{address.full_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {address.street}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {address.city}, {address.state} {address.zip_code}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {address.country}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Phone: {address.phone}
                  </p>
                </div>

                <div className="flex gap-2">
                  {!address.is_default && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSetDefault(address.id)}
                      disabled={setDefaultAddress.isPending}
                      className="flex-1"
                    >
                      Set as Default
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(address)}
                    className={address.is_default ? 'flex-1' : ''}
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(address.id)}
                    disabled={deleteAddress.isPending || address.is_default}
                  >
                    {deleteAddress.isPending ? (
                      <SerkleLoader size="xs" className="text-current" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <FooterNav active="shop" onSelect={() => {}} onOpenCreate={() => {}} />

      <AddressFormModal
        isOpen={showAddressForm}
        onClose={handleCloseModal}
        editingAddress={editingAddress}
      />
    </div>
  );
};

export default ShippingAddresses;
