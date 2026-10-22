import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ApiActivityIndicator } from './components/ApiActivityIndicator';
import { RewardCelebration } from './components/RewardCelebration';
import { PlayTimeBoundary } from './components/PlayTimeBoundary';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PlayTimeBoundary>
      <App />
      <ApiActivityIndicator />
      <RewardCelebration />
    </PlayTimeBoundary>
  </React.StrictMode>,
);
