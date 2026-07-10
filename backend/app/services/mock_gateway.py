# =============================================================================
# MOCK PAYMENT GATEWAY — PLACEHOLDER IMPLEMENTATION
# =============================================================================
# This module simulates a payment gateway for local development and testing.
# It is intentionally NOT connected to any real payment provider.
#
# What would change when integrating a real gateway (e.g. JazzCash, Easypaisa,
# Stripe):
#
#   1. API KEYS / CREDENTIALS
#      Load gateway-specific secrets from environment variables via
#      app/core/config.py (e.g. JAZZCASH_MERCHANT_ID, JAZZCASH_PASSWORD,
#      STRIPE_SECRET_KEY). Never hard-code them.
#
#   2. HTTP CLIENT
#      Replace asyncio.sleep() + random logic with an actual HTTP call to the
#      gateway's charge/initiate endpoint using httpx.AsyncClient (already in
#      requirements or easy to add). Handle real HTTP errors, timeouts, and
#      rate-limiting.
#
#   3. SIGNATURE / HMAC VERIFICATION
#      Real gateways (especially JazzCash/Easypaisa) require you to build a
#      sorted key-value string and sign it with HMAC-SHA256 before sending and
#      to verify the same signature on every response/callback. Add a
#      _sign_payload() helper here.
#
#   4. WEBHOOK / ASYNC CONFIRMATION
#      Payment status is often confirmed asynchronously via a webhook
#      (callback URL) that the gateway POSTs to your server. You will need:
#        - A dedicated POST /payments/webhook/{provider} endpoint
#        - Signature verification on every incoming webhook
#        - Idempotency: look up the payment by transaction_ref before updating
#          its status to avoid processing the same event twice.
#
#   5. RESPONSE MAPPING
#      Map gateway-specific response codes (e.g. JazzCash pp_ResponseCode "000"
#      for success) to your internal status strings ("success" / "failed") in
#      a _parse_response() helper so the rest of the codebase stays unchanged.
#
# Once the above is in place, swap this class out and the API routes require
# zero changes — the process_payment() contract stays identical.
# =============================================================================

import asyncio
import random
import uuid
from dataclasses import dataclass


@dataclass
class GatewayResult:
    """Normalised result returned by any payment gateway implementation."""
    status: str          # "success" | "failed"
    transaction_ref: str


class MockPaymentGateway:
    """
    Simulates a payment gateway.

    Success rate: 90 % for all electronic methods.
    Cash-on-delivery (cod): always succeeds immediately.
    """

    async def process_payment(
        self,
        amount: float,
        method: str,
        order_id: int,
    ) -> GatewayResult:
        """
        Simulate a gateway charge request.

        Parameters
        ----------
        amount     : float  – order total to charge
        method     : str    – one of "card" / "easypaisa" / "jazzcash" / "cod"
        order_id   : int    – used to build the COD reference

        Returns
        -------
        GatewayResult with status ("success" or "failed") and transaction_ref
        """
        if method == "cod":
            # Cash on delivery — no network round-trip, always succeeds.
            return GatewayResult(
                status="success",
                transaction_ref=f"COD-{order_id}",
            )

        # Simulate network latency for electronic payment methods.
        await asyncio.sleep(1)

        # 90 % success / 10 % failure — mirrors real-world decline rates and
        # lets the frontend exercise its error-handling paths in development.
        status = "success" if random.random() < 0.9 else "failed"
        transaction_ref = str(uuid.uuid4())

        return GatewayResult(status=status, transaction_ref=transaction_ref)
