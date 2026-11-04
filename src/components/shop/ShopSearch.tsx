import React from 'react';
import { Search, User } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@/contexts/UserContext';

interface ShopSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export const ShopSearch: React.FC<ShopSearchProps> = ({ value, onChange }) => {
  const navigate = useNavigate();
  const { user } = useUser();

  const handleProfileClick = () => {
    if (user) {
      navigate(`/seller/${user.id}`);
    }
  };

  return (
    <div className="flex gap-2.5">
      <div className="relative flex-1">
        <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
        <Input
          placeholder="Search products..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pl-11 pr-4 h-11 text-base bg-muted/30 border-border/50 focus:bg-background transition-colors"
        />
      </div>
      <Button 
        variant="outline" 
        size="icon"
        className="touch-target shrink-0 border-border/50"
        onClick={handleProfileClick}
      >
        <User className="h-5 w-5" />
      </Button>
    </div>
  );
};