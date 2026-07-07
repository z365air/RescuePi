const PI_API_BASE = 'https://api.minepi.com/v2';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { paymentId } = req.body;
  if (!paymentId) {
    return res.status(400).json({ error: 'paymentId is required' });
  }

  const apiKey = process.env.PI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'PI_API_KEY not configured' });
  }

  try {
    const piRes = await fetch(`${PI_API_BASE}/payments/${paymentId}/approve`, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await piRes.json();

    if (!piRes.ok) {
      console.error('Pi approve error:', data);
      return res.status(502).json({ error: data.error || 'Pi approval failed' });
    }

    return res.json({ success: true, payment: data });
  } catch (err) {
    console.error('approve handler error:', err);
    return res.status(500).json({ error: err.message });
  }
}
