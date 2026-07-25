import { createRoot } from 'react-dom/client';
import App from './App';
import { initializeAnalytics } from './analytics';
import { initializeCrazyGames } from './crazyGames';
import './styles.css';

async function startApplication() {
  await initializeCrazyGames();
  initializeAnalytics();
  createRoot(document.getElementById('root')!).render(<App />);
}

void startApplication();
