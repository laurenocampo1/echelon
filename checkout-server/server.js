const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim());

app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json());

const TIERS = {
  maintain: {
    name: 'Maintain',
    amount: 150000,
    description: 'Monthly retainer — uptime management and minor adjustments'
  },
  build: {
    name: 'Build',
    amount: 300000,
    description: 'Monthly retainer — 3-month minimum, 2 improvement cycles/month'
  },
  compound: {
    name: 'Compound',
    amount: 500000,
    description: 'Monthly retainer — unlimited cycles, full ops partner'
  }
};

app.post('/api/checkout', async (req, res) => {
  try {
    const { tier } = req.body;
    const config = TIERS[tier];
    if (!config) return res.status(400).json({ error: 'Invalid tier' });

    const auth = Buffer.from(`${process.env.PAYMONGO_SECRET_KEY}:`).toString('base64');

    const response = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        data: {
          attributes: {
            send_email_receipt: true,
            show_description: true,
            show_line_items: true,
            line_items: [{
              currency: 'USD',
              amount: config.amount,
              description: config.description,
              name: `Echelon — ${config.name}`,
              quantity: 1
            }],
            payment_method_types: ['card'],
            success_url: `${process.env.SITE_URL}?payment=success`,
            cancel_url: `${process.env.SITE_URL}#tiers`
          }
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('PayMongo error:', JSON.stringify(data));
      return res.status(response.status).json({ error: 'Failed to create checkout session' });
    }

    res.json({ checkout_url: data.data.attributes.checkout_url });
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/health', (_, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`PayMongo checkout server running on port ${PORT}`));
