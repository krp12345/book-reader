import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { VERSION } from '../src/index';

function App() {
  return (
    <main style={{ fontFamily: 'system-ui', padding: '2rem' }}>
      <h1>book-reader demo</h1>
      <p>Library version: {VERSION}</p>
      <p>BookReader component will render here as milestones land.</p>
    </main>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
