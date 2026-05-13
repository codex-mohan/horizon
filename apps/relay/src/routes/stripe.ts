import { Hono } from "hono";
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { authMiddleware } from "../middleware/auth.js";
import { createLogger } from "../lib/logger.js";
import type { User } from "../db/schema.js";

const logger = createLogger("Stripe");

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("Stripe is not configured. Set STRIPE_SECRET_KEY environment variable.");
  }
  return new Stripe(key, {
    apiVersion: "2024-12-18.acacia" as any,
  });
}

const PRICE_IDS: Record<string, string> = {
  pro: process.env.STRIPE_PRO_PRICE_ID || "",
};

const stripeRouter = new Hono<{ Variables: { user: User } }>();

// Create checkout session (protected)
stripeRouter.post("/checkout", authMiddleware, async (c) => {
  try {
    const stripe = getStripe();
    const user = c.get("user");
    const body = await c.req.json<{ tier?: string }>();
    const tier = body.tier || "pro";
    const priceId = PRICE_IDS[tier];

    if (!priceId) {
      return c.json({ error: "Invalid tier" }, 400);
    }

    let customerId = user.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name || undefined,
        metadata: { userId: user.id },
      });
      customerId = customer.id;

      await db
        .update(users)
        .set({ stripeCustomerId: customerId })
        .where(eq(users.id, user.id));
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL}/settings?billing=success`,
      cancel_url: `${process.env.FRONTEND_URL}/pricing?billing=cancel`,
      metadata: { userId: user.id, tier },
    });

    logger.info("Checkout session created", { userId: user.id, sessionId: session.id });

    return c.json({ url: session.url });
  } catch (err) {
    logger.error("Checkout creation failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return c.json({ error: "Failed to create checkout session" }, 500);
  }
});

// Stripe webhook (public, but verified with signature)
stripeRouter.post("/webhook", async (c) => {
  try {
    const stripe = getStripe();
    const payload = await c.req.text();
    const signature = c.req.header("stripe-signature") || "";

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET || ""
      );
    } catch (err) {
      logger.error("Webhook signature verification failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      return c.json({ error: "Invalid signature" }, 400);
    }

  logger.info("Stripe webhook received", { type: event.type });

  switch (event.type) {
    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = (invoice as unknown as Record<string, string>).subscription;
      const customerId = invoice.customer as string;

      if (!subscriptionId || !customerId) break;

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.stripeCustomerId, customerId))
        .limit(1);

      if (user) {
        await db
          .update(users)
          .set({
            tier: "pro",
            stripeSubscriptionId: subscriptionId,
          })
          .where(eq(users.id, user.id));

        logger.info("User upgraded to Pro", { userId: user.id });
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.stripeCustomerId, customerId))
        .limit(1);

      if (user) {
        await db
          .update(users)
          .set({
            tier: "free",
            stripeSubscriptionId: null,
          })
          .where(eq(users.id, user.id));

        logger.info("User downgraded to Free", { userId: user.id });
      }
      break;
    }
  }

    return c.json({ received: true });
  } catch (err) {
    logger.error("Webhook handler error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return c.json({ error: "Webhook processing failed" }, 500);
  }
});

export default stripeRouter;
