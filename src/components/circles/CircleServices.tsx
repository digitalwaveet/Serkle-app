import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useState, useEffect } from 'react';
import { Star, Calendar, DollarSign, Eye, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import CreateServiceModal from './CreateServiceModal';
import BookServiceModal from './BookServiceModal';
import ServiceBookingsModal from './ServiceBookingsModal';
import CircleEmptyState from './CircleEmptyState';

interface CircleServicesProps {
  circle: any;
  isOwner: boolean;
}

interface Service {
  id: string;
  title: string;
  description: string;
  price: number;
  duration_minutes: number;
  category: string;
  rating: number;
  reviews_count: number;
  provider_id: string;
}

const CircleServices: React.FC<CircleServicesProps> = ({ circle, isOwner }) => {
  const { toast } = useToast();
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [bookModalOpen, setBookModalOpen] = useState(false);
  const [bookingsModalOpen, setBookingsModalOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [bookedServiceIds, setBookedServiceIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchServices();
    fetchUserBookings();
  }, [circle.id]);

  const fetchUserBookings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('circle_service_bookings')
        .select('service_id')
        .eq('user_id', user.id);
      if (data) {
        setBookedServiceIds(new Set(data.map(b => b.service_id)));
      }
    } catch {}
  };

  const fetchServices = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('circle_services')
        .select('*')
        .eq('circle_id', circle.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setServices(data || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to load services',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBookService = (service: Service) => {
    setSelectedService(service);
    setBookModalOpen(true);
  };

  const handleViewBookings = (service: Service) => {
    setSelectedService(service);
    setBookingsModalOpen(true);
  };

  return (
    <>
      <div className="px-4 py-6 space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Services & Offerings</h3>
          {isOwner && (
            <Button size="sm" onClick={() => setCreateModalOpen(true)}>
              Add Your Service
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <SerkleLoader size="md" className="text-primary" />
          </div>
        ) : services.length === 0 ? (
          <CircleEmptyState
            icon={Calendar}
            title="No Services Yet"
            description="Offer coaching calls, consultations, or bookable sessions."
            ownerTitle="Create your first service"
            ownerDescription="Offer coaching calls, consultations or other bookable sessions."
            isOwner={isOwner}
            actionLabel="Add Your Service"
            onAction={() => setCreateModalOpen(true)}
          />
        ) : (
          services.map((service) => (
            <Card key={service.id} className="hover:shadow-md transition-shadow mx-0">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-2">{service.title}</CardTitle>
                    <p className="text-sm text-muted-foreground mb-3">{service.description}</p>
                    
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span className="font-medium">{service.rating || 0}</span>
                        <span className="text-muted-foreground">({service.reviews_count || 0})</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{service.duration_minutes} min</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="flex items-center gap-1 mb-2">
                      <DollarSign className="h-4 w-4 text-primary" />
                      <span className="text-lg font-bold text-primary">{service.price}</span>
                    </div>
                    <Badge variant="outline">{service.category}</Badge>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                <div className="flex items-center gap-2">
                  {isOwner ? (
                    <Button 
                      size="sm" 
                      className="flex-1"
                      onClick={() => handleViewBookings(service)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View Bookings
                    </Button>
                  ) : bookedServiceIds.has(service.id) ? (
                    <Button 
                      size="sm" 
                      className="flex-1"
                      variant="secondary"
                      disabled
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Booked
                    </Button>
                  ) : (
                    <Button 
                      size="sm" 
                      className="flex-1"
                      onClick={() => handleBookService(service)}
                    >
                      Book Session
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {isOwner && (
        <CreateServiceModal
          isOpen={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          circleId={circle.id}
          onSuccess={fetchServices}
        />
      )}

      {selectedService && (
        <>
          <BookServiceModal
            isOpen={bookModalOpen}
            onClose={() => {
              setBookModalOpen(false);
              setSelectedService(null);
            }}
            service={selectedService}
            onSuccess={() => {
              fetchServices();
              fetchUserBookings();
              toast({
                title: 'Success',
                description: 'Your booking request has been submitted',
              });
            }}
          />

          <ServiceBookingsModal
            isOpen={bookingsModalOpen}
            onClose={() => {
              setBookingsModalOpen(false);
              setSelectedService(null);
            }}
            serviceId={selectedService.id}
            serviceName={selectedService.title}
          />
        </>
      )}
    </>
  );
};

export default CircleServices;