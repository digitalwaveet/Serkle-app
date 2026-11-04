import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Coins, X } from 'lucide-react';

interface PremiumSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  price: string;
  setPrice: (price: string) => void;
  onSave: () => void;
}

export const PremiumSettingsModal: React.FC<PremiumSettingsModalProps> = ({
  isOpen,
  onClose,
  price,
  setPrice,
  onSave,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md bg-background/80 backdrop-blur-xl border-border/50 shadow-2xl rounded-3xl p-5 md:p-6 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <DialogHeader className="mb-4">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
            <Coins className="w-6 h-6" />
          </div>
          <DialogTitle className="text-xl font-bold">Premium Post Price</DialogTitle>
          <DialogDescription className="text-sm">
            Set the number of coins required to unlock this post.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="premium-price" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Unlock Price (Coins)</Label>
            <div className="relative group">
              <Input
                id="premium-price"
                type="number"
                min="1"
                max="10000"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="50"
                className="bg-muted/10 border-border/50 rounded-2xl pl-10 h-12 text-lg font-bold focus:ring-primary/20 focus:border-primary/30 transition-all placeholder:text-muted-foreground/30"
              />
              <Coins className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-primary group-focus-within:scale-110 transition-transform" />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {[10, 25, 50, 100, 500].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPrice(String(p))}
                className={`flex-1 min-w-[60px] py-2 text-xs font-bold rounded-xl border transition-all duration-200 ${
                  price === String(p)
                    ? 'bg-gradient-to-r from-primary to-primary/80 text-white border-transparent shadow-md shadow-primary/20 scale-105'
                    : 'bg-muted/10 border-border/50 hover:border-primary/50 text-muted-foreground hover:text-foreground hover:bg-muted/20'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 pt-4">
            <Button 
              variant="outline" 
              onClick={onClose}
              className="flex-1 h-12 rounded-2xl border-border/50 font-bold text-muted-foreground hover:text-foreground transition-all"
            >
              Cancel
            </Button>
            <Button 
              onClick={onSave}
              className="flex-[1.5] h-12 rounded-2xl bg-gradient-to-r from-primary to-primary/80 hover:opacity-90 text-white font-bold shadow-lg shadow-primary/20 active:scale-[0.98] transition-all"
            >
              Save Price
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
