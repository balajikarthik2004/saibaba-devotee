// One edge function, several routes, so the public URLs match the client contract:
//   POST {VITE_API_BASE}/payments/stripe/intent
//   POST {VITE_API_BASE}/payments/razorpay/order
//   POST {VITE_API_BASE}/payments/razorpay/verify
//   POST {VITE_API_BASE}/payments/stripe/webhook      (Stripe -> us)
//   POST {VITE_API_BASE}/payments/razorpay/webhook    (Razorpay -> us)
// verify_jwt is OFF for this function (see supabase/config.toml): guests may donate and providers
// call the webhooks without a Supabase JWT. Authentication is done per-route inside.
import { HttpError, serveJson } from '../_shared/http.ts'
import { razorpayOrder, razorpayVerify, stripeIntent } from './intents.ts'
import { razorpayWebhook, stripeWebhook } from './webhooks.ts'

const routes: Record<string, (req: Request) => Promise<Response>> = {
  '/stripe/intent': stripeIntent,
  '/razorpay/order': razorpayOrder,
  '/razorpay/verify': razorpayVerify,
  '/stripe/webhook': stripeWebhook,
  '/razorpay/webhook': razorpayWebhook,
}

Deno.serve(
  serveJson((req) => {
    if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed.')
    const path = new URL(req.url).pathname.replace(/^.*\/payments/, '').replace(/\/$/, '')
    const handler = routes[path]
    if (!handler) throw new HttpError(404, 'Unknown payments route.')
    return handler(req)
  }),
)
