import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PublicUserProfile from '@/components/PublicUserProfile';
import { supabase } from '@/integrations/supabase/client';

const Profile: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserId = async () => {
      if (!username) {
        setError('No username provided');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Check if the param is a UUID (userId) or a username
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(username);

        const query = supabase
          .from('profiles')
          .select('id');

        const { data, error } = isUuid
          ? await query.eq('id', username).single()
          : await query.eq('username', username).single();

        if (error) throw error;

        if (data) {
          setUserId(data.id);
        } else {
          setError('User not found');
        }
      } catch (err) {
        console.error('Error fetching user:', err);
        setError('User not found');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserId();
  }, [username]);

  const handleMessageClick = () => {
    if (userId) {
      navigate(`/messages?userId=${userId}`);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-lg border-b border-border/50 px-4 py-3">
          <div className="flex items-center justify-between">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate(-1)}
              className="hover:bg-muted/50 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            
            <h1 className="text-xl font-bold text-foreground">Profile</h1>
            
            <div className="w-10" />
          </div>
        </div>

        <div className="min-h-48 w-full flex items-center justify-center py-8"><SerkleLoader label="Loading profile" showText /></div>
      </div>
    );
  }

  if (error || !userId) {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-lg border-b border-border/50 px-4 py-3">
          <div className="flex items-center justify-between">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate(-1)}
              className="hover:bg-muted/50 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            
            <h1 className="text-xl font-bold text-foreground">Profile</h1>
            
            <div className="w-10" />
          </div>
        </div>

        <div className="flex flex-col items-center justify-center py-12 px-4">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground mb-2">User Not Found</h2>
            <p className="text-muted-foreground mb-6">
              The user you're looking for doesn't exist or has been removed.
            </p>
            <Button onClick={() => navigate(-1)}>
              Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-lg border-b border-border/50 px-4 py-3">
        <div className="flex items-center justify-between">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate(-1)}
            className="hover:bg-muted/50 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          <h1 className="text-xl font-bold text-foreground">Profile</h1>
          
          <div className="w-10" />
        </div>
      </div>

      <PublicUserProfile 
        userId={userId}
        showHeader={false}
        onMessageClick={handleMessageClick}
      />
    </div>
  );
};

export default Profile;
