import React, { useEffect, useState } from 'react';
import { TatvicWrapper } from '../../../src/react.js';

declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}

export function App() {
  const [status, setStatus] = useState<string>('Ready');

  useEffect(() => {
    // Initialize GTM dataLayer
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };
    window.gtag('js', new Date());

    // Inject morphed GTM script dynamically
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtm.js?id=GTM-T32XGF8F';
    document.head.appendChild(script);
  }, []);

  const handleTrackLead = async () => {
    setStatus('Sending generate_lead telemetry...');

    // Push generate_lead event to GTM
    window.gtag('event', 'generate_lead', {
      value: 129.0,
      currency: 'USD',
    });

    // Send direct GA4 beacon to sGTM container
    try {
      const res = await fetch('https://tpozgxiu.usu.stape.io/g/collect?v=2&tid=G-TEST&en=generate_lead', {
        method: 'POST',
        body: 'event=generate_lead&value=129.00',
      });
      setStatus(`Success! Relayed to sGTM with HTTP status: ${res.status}`);
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    }
  };

  return (
    <TatvicWrapper>
      <div style={{ fontFamily: 'sans-serif', padding: '2rem' }}>
        <h1>React SPA + GTM Demo</h1>
        <p>GTM Container ID: <code>GTM-T32XGF8F</code></p>
        <button
          onClick={handleTrackLead}
          style={{ padding: '10px 20px', cursor: 'pointer', fontSize: '15px' }}
        >
          Track React Generate Lead Event
        </button>
        <p style={{ marginTop: '1rem', color: '#0070f3', fontWeight: 'bold' }}>{status}</p>
      </div>
    </TatvicWrapper>
  );
}
