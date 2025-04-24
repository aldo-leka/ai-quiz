import { Express, Request, Response } from 'express';
import Stripe from 'stripe';
import { addCreditsToUser } from '../../db/users';
import { authenticate } from './auth';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16'
});

export function setupPaymentRoutes(app: Express) {
  // Check Stripe session status
  app.get('/api/payments/session/:sessionId', authenticate, async (req: any, res) => {
    try {
      const { sessionId } = req.params;
      
      if (!sessionId) {
        return res.status(400).json({ message: 'Session ID is required' });
      }
      
      // Retrieve the session from Stripe
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      
      if (!session) {
        return res.status(404).json({ message: 'Session not found' });
      }
      
      // Check if this session belongs to the authenticated user
      if (session.metadata?.userId !== req.user.id) {
        return res.status(403).json({ message: 'Unauthorized' });
      }
      
      // Return the session information
      res.status(200).json({
        status: session.status,
        paymentStatus: session.payment_status,
        amount: session.metadata?.creditAmount || 0,
        isPending: session.status !== 'complete' || session.payment_status !== 'paid'
      });
    } catch (error) {
      console.error('Error fetching session:', error);
      res.status(500).json({ message: 'Failed to fetch session' });
    }
  });
  // Payment routes
  app.post('/api/payments/create-checkout-session', authenticate, async (req: any, res) => {
    try {
      const { amount } = req.body;
      const userId = req.user.id;
      
      if (!amount || amount <= 0) {
        return res.status(400).json({ message: 'Invalid credit amount' });
      }
      
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
        success_url: `${process.env.CORS_ORIGIN}/host/credits/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.CORS_ORIGIN}/host/credits`,
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
  
  // Webhook handler - raw body parsing is set up in server.ts
  app.post('/api/payments/webhook', async (req: Request, res: Response) => {
    const signature = req.headers['stripe-signature'] as string;
    
    try {
      // req.body is already the raw buffer because of the express.raw middleware
      
      // Verify the webhook signature
      const event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET || ''
      );
      
      // Handle the event
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        
        if (!session.metadata?.userId || !session.metadata?.creditAmount) {
          throw new Error('Missing user ID or credit amount in session metadata');
        }
        
        const userId = session.metadata.userId;
        const creditAmount = parseInt(session.metadata.creditAmount);
        
        if (isNaN(creditAmount) || creditAmount <= 0) {
          throw new Error(`Invalid credit amount: ${session.metadata.creditAmount}`);
        }
        
        console.log(`Processing payment for user ${userId}: ${creditAmount} credits`);
        
        // Add credits to the user's account
        const success = await addCreditsToUser(userId, creditAmount);
        
        if (!success) {
          throw new Error(`Failed to add credits to user ${userId}`);
        }
        
        console.log(`Successfully added ${creditAmount} credits to user ${userId}`);
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

