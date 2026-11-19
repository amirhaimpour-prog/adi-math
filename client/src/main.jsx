import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import { UiProvider } from './ui/ui.jsx';

// A data router (needed for unsaved-changes blocking in the editor) wrapping the app's own <Routes>.
const router = createBrowserRouter([
  { path: '*', element: <UiProvider><App /></UiProvider> },
]);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
