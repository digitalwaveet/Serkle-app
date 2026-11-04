import { useUser } from '@/contexts/UserContext';
import { SubscribeCircleModal } from './SubscribeCircleModal';
import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useState } from 'react';
import { Download, FileText, Video, Image, Lock, Star, Upload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { toast } from 'sonner';
import UploadResourceModal from './UploadResourceModal';
import CircleEmptyState from './CircleEmptyState';

interface CircleResourcesProps {
  circle: any;
  isOwner: boolean;
}

const getIcon = (type: string) => {
  switch (type) {
    case 'Video': return Video;
    case 'Image': return Image;
    default: return FileText;
  }
};

const CircleResources: React.FC<CircleResourcesProps> = ({ circle, isOwner }) => {
  const [filter, setFilter] = useState('all');
  const [showUpload, setShowUpload] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useUser();
  const [subscribeOpen, setSubscribeOpen] = useState(false);

  const { data: resources, isLoading, isError: isAccessError, refetch: retryAccess } = useQuery({
    queryKey: ['circle-resources', circle.id, user?.id],
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_circle_resources' as any, { _circle_id: circle.id });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!circle.id,
  });

  // Real-time subscription
  useRealtimeSubscription([{
    table: 'circle_resources',
    filter: `circle_id=eq.${circle.id}`,
    invalidateQueries: ['circle-resources', 'circle-stats'],
  }]);

  const handleDownload = async (resource: any) => {
    if (!resource.can_access) { setSubscribeOpen(true); return; }
    try {
      // Create a signed URL for private bucket download
      const { data: signedData, error: signedError } = await supabase.storage
        .from('circle-resources')
        .createSignedUrl(resource.file_url, 60);

      if (signedError) throw signedError;

      const response = await fetch(signedData.signedUrl);
      if (!response.ok) throw new Error('Access expired or download unavailable');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = resource.title;
      a.click();
      URL.revokeObjectURL(url);

      // Increment download count
      await supabase
        .from('circle_resources')
        .update({ downloads_count: (resource.downloads_count || 0) + 1 })
        .eq('id', resource.id);
      
      queryClient.invalidateQueries({ queryKey: ['circle-resources', circle.id] });
    } catch (err: any) {
      toast.error('Download failed: ' + (err.message || 'Unknown error'));
    }
  };

  const filteredResources = (resources || []).filter(r => {
    if (filter === 'free') return !r.is_premium;
    if (filter === 'premium') return r.is_premium;
    return true;
  });

  if (isLoading) {
    return (
      <div className="min-h-48 w-full flex items-center justify-center py-8"><SerkleLoader label="Loading circles" showText /></div>
    );
  }

  if (isAccessError) return <div className="p-6 text-center"><p>Could not verify access.</p><Button onClick={() => retryAccess()}>Retry</Button></div>;

  return (
    <div className="px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Resources</h3>
        {isOwner && (
          <Button size="sm" onClick={() => setShowUpload(true)}>
            <Upload className="h-4 w-4 mr-1" />
            Upload File
          </Button>
        )}
      </div>

      <SubscribeCircleModal isOpen={subscribeOpen} onClose={() => setSubscribeOpen(false)} circleId={circle.id} circleName={circle.name} subscriptionPrice={circle.subscription_price} onSubscribed={() => queryClient.invalidateQueries({ queryKey: ['circle-resources', circle.id] })} />
      <Tabs value={filter} onValueChange={setFilter} className="mb-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="free">Free</TabsTrigger>
          <TabsTrigger value="premium">Premium</TabsTrigger>
        </TabsList>

        <div className="max-h-[500px] overflow-y-auto">
          <TabsContent value={filter} className="space-y-4 mt-4 pr-2">
            {filteredResources.length === 0 ? (
              <CircleEmptyState
                icon={FileText}
                title="No Resources Yet"
                description="Share guides, templates, or files your members can download."
                ownerTitle="Upload your first resource"
                ownerDescription="Share guides, templates and files your members can download."
                isOwner={isOwner}
                actionLabel="Upload File"
                onAction={() => setShowUpload(true)}
              />
            ) : (
              filteredResources.map((resource) => {
                const IconComponent = getIcon(resource.resource_type);
                return (
                  <Card key={resource.id} className="hover:shadow-md transition-shadow mx-0">
                    <CardHeader className="pb-3 px-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                          <IconComponent className="h-8 w-8 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-2 gap-2">
                            <CardTitle className="text-base font-semibold leading-tight line-clamp-2 flex-1">
                              {resource.title}
                            </CardTitle>
                            <div className="flex flex-col gap-1 flex-shrink-0">
                              {resource.is_premium && (
                                <Badge variant="default" className="text-xs">
                                  <Lock className="h-2 w-2 mr-1" />
                                  Premium
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-xs">{resource.resource_type}</Badge>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground mb-3 line-clamp-2 leading-relaxed">
                            {resource.description}
                          </p>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span className="truncate">by {resource.profiles?.name || 'Unknown'}</span>
                            {resource.file_size_mb && <span>{resource.file_size_mb} MB</span>}
                            <span>{resource.downloads_count || 0} downloads</span>
                            {resource.rating && (
                              <div className="flex items-center gap-1">
                                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                <span>{resource.rating}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0 px-4">
                      <Button
                        size="sm"
                        className="w-full text-xs"
                        onClick={() => handleDownload(resource)}
                      >
                        <Download className="h-3 w-3 mr-1" />
                        {resource.can_access ? 'Download' : 'Subscribe for access'}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>
        </div>
      </Tabs>

      {isOwner && filteredResources.length > 0 && (
        <Card className="border-dashed mt-4 mx-0">
          <CardContent className="p-4 text-center">
            <h4 className="font-medium mb-2">Share Your Resources</h4>
            <p className="text-sm text-muted-foreground mb-4">
              Upload helpful documents, videos, or tools for the community
            </p>
            <Button variant="outline" onClick={() => setShowUpload(true)}>
              <Upload className="h-4 w-4 mr-1" />
              Upload Resource
            </Button>
          </CardContent>
        </Card>
      )}

      <UploadResourceModal
        open={showUpload}
        onOpenChange={setShowUpload}
        circleId={circle.id}
        isOwner={isOwner}
      />
    </div>
  );
};

export default CircleResources;
