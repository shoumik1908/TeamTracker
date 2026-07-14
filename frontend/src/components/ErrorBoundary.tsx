import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error in boundary:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-6 rounded-2xl bg-red-950/15 border border-red-500/20 text-center space-y-2">
          <p className="text-sm font-semibold text-red-400">Something went wrong loading this section</p>
          <p className="text-xs text-muted-foreground">Please try reloading or check the developer console.</p>
        </div>
      );
    }

    return this.props.children;
  }
}
