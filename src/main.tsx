import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ApiActivityIndicator } from './components/ApiActivityIndicator';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <ApiActivityIndicator />
  </React.StrictMode>,
);
