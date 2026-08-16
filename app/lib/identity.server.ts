export interface WishlistIdentity {
  customerId: string | null;
  guestToken: string | null;
}

export function getIdentity(request: Request): WishlistIdentity {
  const url = new URL(request.url);
  const customerId = url.searchParams.get("logged_in_customer_id") || null;
  const guestToken = url.searchParams.get("guest_token") || null;

  if (!customerId && !guestToken) {
    throw Response.json(
      { error: "Requires logged_in_customer_id or guest_token" },
      { status: 400 },
    );
  }

  return { customerId, guestToken };
}
