import { Component, type ReactNode } from 'react';

interface Props {
  fallback: (error: Error) => ReactNode;
  onError?: (error: Error) => void;
  children: ReactNode;
}

/** Contains a failure (e.g. no WebGL, model download failed) to the part of the page that broke. */
export class ErrorBoundary extends Component<Props, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    this.props.onError?.(error);
  }

  render() {
    return this.state.error ? this.props.fallback(this.state.error) : this.props.children;
  }
}
