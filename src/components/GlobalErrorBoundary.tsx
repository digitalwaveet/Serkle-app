import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class GlobalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    // TODO: Send to error tracking service (Sentry, etc.)
    console.error('[GlobalErrorBoundary] Uncaught error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-md w-full text-center space-y-6">
            {/* Error Icon */}
            <div className="mx-auto w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-10 h-10 text-destructive"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>
            </div>

            {/* Error Message */}
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-foreground">
                Something went wrong
              </h1>
              <p className="text-muted-foreground text-sm leading-relaxed">
                We're sorry, but something unexpected happened. Please try again
                or go back to the home page.
              </p>
            </div>

            {/* Error Details (collapsed) */}
            {this.state.error && (
              <details className="text-left bg-muted/50 rounded-xl p-4 text-xs">
                <summary className="cursor-pointer text-muted-foreground font-medium">
                  Error details
                </summary>
                <pre className="mt-2 text-destructive/80 whitespace-pre-wrap break-words overflow-auto max-h-40">
                  {this.state.error.message}
                  {this.state.errorInfo?.componentStack && (
                    <>
                      {'\n\nComponent Stack:'}
                      {this.state.errorInfo.componentStack}
                    </>
                  )}
                </pre>
              </details>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col gap-3">
              <button
                onClick={this.handleReset}
                className="w-full py-3 px-6 rounded-xl font-semibold text-sm transition-all duration-200 bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98]"
              >
                Try Again
              </button>
              <button
                onClick={this.handleGoHome}
                className="w-full py-3 px-6 rounded-xl font-semibold text-sm transition-all duration-200 bg-muted text-foreground hover:bg-muted/80 active:scale-[0.98]"
              >
                Go Home
              </button>
            </div>

            {/* Branding */}
            <p className="text-xs text-muted-foreground/60">
              Serkle &middot; Connect, Share, Support
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default GlobalErrorBoundary;
