"use client";

import { Component, ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="rounded-xl p-6 space-y-3 bg-card border border-red-500/30">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <p className="text-sm font-medium text-foreground">Something went wrong</p>
          </div>
          <p className="text-xs text-muted-foreground">
            {this.state.error?.message || "An unexpected error occurred while loading this section."}
          </p>
          <Button size="sm" variant="outline" onClick={this.handleReset} className="h-7 text-xs gap-1.5">
            <RefreshCw className="h-3 w-3" />
            Try again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
