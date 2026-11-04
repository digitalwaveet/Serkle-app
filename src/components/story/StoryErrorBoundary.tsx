import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class StoryErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('StoryErrorBoundary caught an error:', error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="w-full h-full min-h-[300px] flex flex-col items-center justify-center bg-black/90 rounded-xl p-6 text-center animate-in fade-in zoom-in duration-300">
          <div className="size-16 rounded-full bg-destructive/20 flex items-center justify-center mb-4">
            <AlertTriangle className="size-8 text-destructive" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Story Unavailable</h3>
          <p className="text-white/60 text-sm mb-6 max-w-[250px]">
            We couldn't load this story. It may have expired or encountered an error.
          </p>
          <Button 
            onClick={this.handleRetry}
            variant="outline" 
            className="border-white/20 text-white hover:bg-white/10"
          >
            <RefreshCw className="size-4 mr-2" />
            Try Again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
