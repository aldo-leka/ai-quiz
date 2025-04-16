import { Express } from 'express';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16'
});

export function setupPaymentRoutes(app: Express) {
  // Payment routes
  app.post('/api/payments/create-checkout-session', async (req, res) => {
    try {
      const { userId, amount } = req.body;
      
      // Create a Stripe checkout session
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: `${amount} Quiz Credits`,
                description: `Purchase ${amount} credits for creating AI quizzes`,
              },
              unit_amount: calculatePriceInCents(amount),
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${process.env.CORS_ORIGIN}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.CORS_ORIGIN}/payment/cancel`,
        metadata: {
          userId,
          creditAmount: amount.toString(),
        },
      });
      
      res.status(200).json({ id: session.id, url: session.url });
    } catch (error) {
      console.error('Error creating checkout session:', error);
      res.status(500).json({ message: 'Failed to create checkout session' });
    }
  });
  
  app.post('/api/payments/webhook', async (req, res) => {
    const signature = req.headers['stripe-signature'] as string;
    
    try {
      // Verify the webhook signature
      const event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET || ''
      );
      
      // Handle the event
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        
        // Add credits to the user's account
        await addCreditsToUser(
          session.metadata?.userId || '',
          parseInt(session.metadata?.creditAmount || '0')
        );
      }
      
      res.status(200).json({ received: true });
    } catch (error) {
      console.error('Error processing webhook:', error);
      res.status(400).json({ message: 'Webhook error' });
    }
  });
}

// Helper function to calculate the price in cents based on the amount of credits
function calculatePriceInCents(amount: number): number {
  // Apply discounts for larger purchases
  if (amount >= 50) {
    // 20% discount
    return Math.floor(amount * 100 * 0.8);
  } else if (amount >= 15) {
    // 13% discount
    return Math.floor(amount * 100 * 0.87);
  } else {
    // No discount
    return amount * 100;
  }
}

// Helper function to add credits to a user's account
async function addCreditsToUser(userId: string, amount: number): Promise<void> {
  // Add credits to the user's account in the database
  // This is a placeholder - will be implemented later
  console.log(`Adding ${amount} credits to user ${userId}`);
}
