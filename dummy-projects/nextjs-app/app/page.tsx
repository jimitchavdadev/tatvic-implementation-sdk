'use client';

import React, { useState } from 'react';

export default function HomePage() {
  const [log, setLog] = useState<string>('Ready');

  const triggerGtmEvent = async () => {
    setLog('Dispatching GA4 telemetry...');

    // Trigger dataLayer event
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'conversion', {
        send_to: 'AW-123456789/AbC-D_efG-h12_34-56',
        value: 199.99,
        currency: 'USD',
      });
    }

    // Direct GA4 collect beacon to sGTM container
    try {
      const res = await fetch('https://tpozgxiu.usu.stape.io/g/collect?v=2&tid=G-XXXXX&en=generate_lead', {
        method: 'POST',
        body: 'en=generate_lead&value=199.99',
      });
      setLog(`Telemetry successfully relayed to sGTM! HTTP status: ${res.status}`);
    } catch (e: any) {
      setLog(`Error: ${e.message}`);
    }
  };

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Next.js App Router + GTM Demo</h1>
      <p>Container ID: <code>GTM-T32XGF8F</code></p>
      <button
        onClick={triggerGtmEvent}
        style={{ padding: '12px 24px', fontSize: '16px', cursor: 'pointer' }}
      >
        Send Next.js Conversion Event
      </button>
      <p style={{ marginTop: '1.5rem', color: '#16a34a', fontWeight: 'bold' }}>{log}</p>
    </main>
  );
}
