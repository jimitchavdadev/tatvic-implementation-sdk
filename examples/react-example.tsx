import React from 'react';
import { TatvicWrapper } from '../src/index.js';

export function App() {
  return (
    <TatvicWrapper>
      <div>
        <h1>My Web App</h1>
        <button
          onClick={() => {
            // Standard tracking call:
            // Interceptor transparently rewrites this to first-party /_tatvic/relay
            fetch('https://www.google-analytics.com/g/collect?v=2', {
              method: 'POST',
              body: 'en=click_button',
            });
          }}
        >
          Track Event
        </button>
      </div>
    </TatvicWrapper>
  );
}
