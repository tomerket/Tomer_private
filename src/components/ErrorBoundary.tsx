import { Component, type ReactNode } from 'react';

/** If a page crashes, show a short message with a way back instead of a blank white screen. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error(error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="grid min-h-dvh place-items-center p-6">
        <div className="panel max-w-md p-6 text-center">
          <h1 className="text-3xl font-extrabold">Something went wrong on this page</h1>
          <p className="mt-2 text-lg text-muted">Your data is safe. Reload the page to continue.</p>
          <button className="btn btn-primary mt-5" onClick={() => window.location.reload()}>
            Reload page
          </button>
        </div>
      </div>
    );
  }
}
