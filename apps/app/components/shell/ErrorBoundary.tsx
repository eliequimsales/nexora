'use client';

import { Component, type ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center py-16 text-center px-4">
          <AlertCircle size={22} className="text-status-error mb-3 opacity-70" />
          <p className="text-sm font-medium text-text-primary mb-1">Algo deu errado nesta seção</p>
          <p className="text-xs text-text-muted mb-4">
            Tente recarregar a página. Se o problema persistir, entre em contato com o suporte.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="text-xs text-brand-amber hover:underline"
          >
            Tentar novamente
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
