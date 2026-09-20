import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import SiteRouter from './SiteRouter.tsx';
import BrandIntro from './components/BrandIntro.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/^\/(portal|workspace|local)\/?$/.test(window.location.pathname) && <BrandIntro />}
    <SiteRouter />
  </StrictMode>,
);
