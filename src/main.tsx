import { Component, StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="shell">
        <section className="card">
          <h1>暫時無法開啟畫室</h1>
          <p>
            請確認瀏覽器允許本機儲存，再重新開啟。若仍有問題，請先保留瀏覽器資料，避免失去作品。
          </p>
          <button onClick={() => location.reload()}>重新開啟</button>
        </section>
      </main>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
