const PI_API_BASE = 'https://api.minepi.com/v2';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { paymentId, txid } = req.body;
  if (!paymentId || !txid) {
    return res.status(400).json({ error: 'paymentId and txid are required' });
  }

  const apiKey = process.env.PI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'PI_API_KEY not configured' });
  }

  try {
    const piRes = await fetch(`${PI_API_BASE}/payments/${paymentId}/complete`, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ txid }),
    });

    const data = await piRes.json();

    if (!piRes.ok) {
      console.error('Pi complete error:', data);
      return res.status(502).json({ error: data.error || 'Pi completion failed' });
    }

    return res.json({ success: true, payment: data });
  } catch (err) {
    console.error('complete handler error:', err);
    return res.status(500).json({ error: err.message });
  }
}
