import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card } from '@/components/ui/card';
import { 
  MessageCircle, 
  ThumbsUp, 
  Clock, 
  Plus,
  Award,
  AlertTriangle,
  GitBranch,
  Sparkles,
  MoreVertical
} from 'lucide-react';

interface ThreadUpdate {
  id: string;
  content: string;
  timestamp: string;
  upvotes: number;
  isOriginalPoster: boolean;
}

interface AnonymousThread {
  id: string;
  originalQuestion: string;
  category: string;
  tags: string[];
  timestamp: string;
  upvotes: number;
  isUrgent: boolean;
  hasExpertAnswer: boolean;
  updates: ThreadUpdate[];
  canContinue: boolean; // If current user is original poster
}

interface AnonymousThreadProps {
  thread: AnonymousThread;
  onContinueThread?: () => void;
  onUpvote?: (updateId: string) => void;
}

export const AnonymousThreadComponent: React.FC<AnonymousThreadProps> = ({
  thread,
  onContinueThread,
  onUpvote
}) => {
  const [showAllUpdates, setShowAllUpdates] = useState(false);
  
  const displayedUpdates = showAllUpdates ? thread.updates : thread.updates.slice(0, 2);
  const hasMoreUpdates = thread.updates.length > 2;

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'parenting': return '👶';
    case 'health': return '🏥';
    case 'relationships': return '💕';
    case 'career': return '💼';
    case 'mental-health': return '🧠';
    case 'education': return '📚';
    case 'lifestyle': return '🌟';
    case 'family': return '👨‍👩‍👧‍👦';
    default: return '❓';
  }
};

const getCategoryColor = (category: string) => {
  switch (category) {
    case 'parenting': return 'bg-blue-100 text-blue-800';
    case 'health': return 'bg-red-100 text-red-800';
    case 'relationships': return 'bg-pink-100 text-pink-800';
    case 'career': return 'bg-purple-100 text-purple-800';
    case 'mental-health': return 'bg-green-100 text-green-800';
    case 'education': return 'bg-yellow-100 text-yellow-800';
    case 'lifestyle': return 'bg-indigo-100 text-indigo-800';
    case 'family': return 'bg-orange-100 text-orange-800';
    default: return 'bg-muted/50 text-foreground';
  }
};

  return (
    <div className="space-y-0">
      {/* Original Post - Compact Design */}
      <Card className="overflow-hidden border-l-2 border-l-primary bg-gradient-to-r from-primary/3 via-background to-secondary/3">
        <div className="p-3">
          <div className="flex items-start gap-2 mb-2">
            <div className="relative flex-shrink-0">
              <img 
                src="/src/assets/anonymous-logo.png" 
                alt="Anonymous" 
                className="w-7 h-7 rounded-full border-2 border-primary/30 shadow-sm"
              />
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-primary rounded-full border-2 border-white flex items-center justify-center">
                <GitBranch className="w-1 h-1 text-white" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-username font-semibold text-foreground text-sm truncate">Anonymous</span>
                  <Badge className="bg-gradient-to-r from-primary/20 to-secondary/20 text-primary border-0 px-1.5 py-0.5 text-xs flex-shrink-0">
                    <Sparkles className="w-2.5 h-2.5 mr-1" />
                    <span className="hidden xs:inline">Story Thread</span>
                    <span className="xs:hidden">Thread</span>
                  </Badge>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                  {thread.isUrgent && (
                    <Badge variant="destructive" className="text-xs animate-pulse flex-shrink-0">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      <span className="hidden sm:inline">Urgent</span>
                    </Badge>
                  )}
                  {thread.hasExpertAnswer && (
                    <Badge className="bg-gradient-to-r from-primary to-secondary text-primary-foreground text-xs flex-shrink-0">
                      <Award className="w-3 h-3 mr-1" />
                      <span className="hidden sm:inline">Expert</span>
                    </Badge>
                  )}
                </div>
              </div>
              <span className="text-timestamp text-muted-foreground text-xs">{thread.timestamp}</span>
            </div>
          </div>

          <p className="text-post-content text-foreground leading-relaxed font-normal mb-2 text-sm break-words overflow-hidden">
            {thread.originalQuestion}
          </p>

          {/* Tags */}
          <div className="flex flex-wrap gap-1 mb-2 overflow-hidden">
            {thread.tags.slice(0, 4).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs hover:bg-primary/10 transition-colors flex-shrink-0">
                #{tag}
              </Badge>
            ))}
            {thread.tags.length > 4 && (
              <Badge variant="outline" className="text-xs flex-shrink-0">
                +{thread.tags.length - 4}
              </Badge>
            )}
          </div>

          {/* Original Post Stats */}
          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <div className="flex items-center gap-3 text-sm text-muted-foreground min-w-0 flex-1">
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-auto p-0 text-muted-foreground hover:text-primary transition-colors flex-shrink-0"
              >
                <ThumbsUp className="w-4 h-4 mr-1" />
                {thread.upvotes}
              </Button>
              <div className="flex items-center min-w-0">
                <MessageCircle className="w-4 h-4 mr-1 flex-shrink-0" />
                <span className="text-xs truncate">{thread.updates.length} update{thread.updates.length !== 1 ? 's' : ''}</span>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="flex-shrink-0">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Thread Updates - Enhanced Design */}
      {thread.updates.length > 0 && (
        <div className="relative ml-8 mt-4">
          {/* Main Thread Line */}
          <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary via-primary/60 to-transparent" />
          
          {displayedUpdates.map((update, index) => (
            <div key={update.id} className="relative mb-4">
              {/* Thread Connector Line */}
              <div className="absolute left-2 top-6 w-8 h-0.5 bg-primary/40" />
              
              {/* Thread Dot */}
              <div className="absolute left-0 top-5 w-4 h-4 bg-primary rounded-full border-3 border-white shadow-lg flex items-center justify-center z-10">
                <div className="w-1.5 h-1.5 bg-card rounded-full" />
              </div>
              
               <Card className="ml-12 border-l-2 border-l-primary/30 hover:border-l-primary/60 transition-all duration-200 hover:shadow-md overflow-hidden">
                 <div className="px-3 pb-3 pt-4">
                   <div className="flex items-start justify-between mb-2">
                     <div className="flex items-center gap-2 min-w-0 flex-1">
                       <img 
                         src="/src/assets/anonymous-logo.png" 
                         alt="Anonymous" 
                         className="w-6 h-6 rounded-full border border-primary/20 flex-shrink-0"
                       />
                       <div className="flex items-center gap-2 min-w-0 flex-1">
                         <span className="text-sm font-medium text-foreground truncate">Anonymous</span>
                         {update.isOriginalPoster && (
                           <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/30 flex-shrink-0">
                             OP
                           </Badge>
                         )}
                         <span className="text-xs text-muted-foreground hidden xs:inline">•</span>
                         <span className="text-xs text-muted-foreground truncate hidden xs:inline">{update.timestamp}</span>
                       </div>
                     </div>
                     
                     <Button
                       variant="ghost"
                       size="sm"
                       onClick={() => onUpvote?.(update.id)}
                       className="text-muted-foreground hover:text-primary h-8 px-2 transition-colors flex-shrink-0"
                     >
                       <ThumbsUp className="w-3 h-3 mr-1" />
                       <span className="text-xs">{update.upvotes}</span>
                     </Button>
                   </div>
                   
                   <div className="xs:hidden mb-1">
                     <span className="text-xs text-muted-foreground">{update.timestamp}</span>
                   </div>
                   
                   <p className="text-post-content text-foreground leading-relaxed font-normal text-sm break-words overflow-hidden">
                     {update.content}
                   </p>
                 </div>
               </Card>
              
              {/* Progress indicator for updates */}
              {index < displayedUpdates.length - 1 && (
                <div className="absolute left-1 top-16 w-2 h-6 bg-gradient-to-b from-primary/30 to-primary/10 rounded-full" />
              )}
            </div>
          ))}

          {/* Show More Updates Button */}
          {hasMoreUpdates && !showAllUpdates && (
            <div className="relative mb-4">
              <div className="absolute left-2 top-6 w-8 h-0.5 bg-primary/40" />
              <div className="absolute left-0 top-5 w-4 h-4 bg-muted-foreground/60 rounded-full border-3 border-white shadow-sm" />
              
              <div className="ml-12">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAllUpdates(true)}
                  className="border-dashed border-primary/40 text-primary hover:bg-primary/5 hover:border-primary"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Show {thread.updates.length - 2} more update{thread.updates.length - 2 !== 1 ? 's' : ''}
                </Button>
              </div>
            </div>
          )}

          {/* Continue Thread Button */}
          {thread.canContinue && (
            <div className="relative">
              <div className="absolute left-2 top-6 w-8 h-0.5 bg-primary/40" />
              <div className="absolute left-0 top-5 w-4 h-4 bg-primary rounded-full border-3 border-white shadow-lg animate-pulse" />
              
               <Card className="ml-12 border-2 border-dashed border-primary/40 bg-gradient-to-r from-primary/5 to-secondary/5 hover:from-primary/10 hover:to-secondary/10 transition-all duration-200 overflow-hidden">
                 <div className="p-3 text-center">
                   <Button
                     onClick={onContinueThread}
                     className="bg-gradient-to-r from-primary to-secondary text-white hover:from-primary/90 hover:to-secondary/90 shadow-md w-full xs:w-auto"
                     size="sm"
                   >
                     <Plus className="w-4 h-4 mr-2" />
                     Continue your story
                   </Button>
                   <p className="text-xs text-muted-foreground mt-2 break-words">Share your latest update with the community</p>
                 </div>
               </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AnonymousThreadComponent;