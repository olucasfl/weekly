import { Component, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '100dvh', padding: 32, gap: 16, textAlign: 'center',
          fontFamily: 'var(--font)',
        }}>
          <div style={{ fontSize: '2rem' }}>⚠️</div>
          <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
            Algo deu errado
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: 280 }}>
            {this.state.error.message || 'Erro inesperado. Recarregue a página.'}
          </div>
          <button
            className="btn btn-primary"
            onClick={() => window.location.reload()}
          >
            Recarregar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
