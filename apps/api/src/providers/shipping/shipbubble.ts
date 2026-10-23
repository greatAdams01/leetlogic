import { z } from "zod";
import { AppError } from "../../lib/errors.js";
import { getConfig } from "../../config.js";
export const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().email(),
  phone: z.string().regex(/^\+?\d{10,15}$/),
  address: z.string().trim().min(15).max(500),
  state: z.string().trim().min(2).max(80),
  country: z.literal("NG").default("NG"),
});
export const parcelSchema = z.object({
  weightKg: z.number().positive(),
  length: z.number().positive().max(200),
  width: z.number().positive().max(200),
  height: z.number().positive().max(200),
  pickupDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  handling: z.enum(["STANDARD", "PERISHABLE", "COLD_CHAIN", "BULK"]),
});
export type Contact = z.infer<typeof contactSchema>;
export type Parcel = z.infer<typeof parcelSchema>;
export type ShippingRate = {
  courierId: string;
  walletMinor: bigint;
  requestToken: string;
  serviceCode: string;
  courier: string;
  amountMinor: bigint;
  eta?: string;
};
export type TrackedShipment = {
  id: string;
  status: string;
  trackingUrl?: string;
  courier: string;
  pickupAddress?: string;
  destinationAddress?: string;
  shippingMinor?: bigint;
  observedAt?: string;
};
export interface ShippingProvider {
  validateAddress(contact: Contact): Promise<number>;
  quotes(input: {
    pickup: Contact;
    destination: Contact;
    parcel: Parcel;
    name: string;
    valueMinor: bigint;
  }): Promise<ShippingRate[]>;
  book(
    quote: Pick<ShippingRate, "requestToken" | "serviceCode" | "courierId">,
  ): Promise<TrackedShipment>;
  track(id: string): Promise<TrackedShipment>;
  cancel(id: string): Promise<void>;
}
const trackingSchema = z.object({
  order_id: z.string(),
  status: z.string(),
  tracking_url: z.string().optional(),
  courier: z.object({ name: z.string() }),
  ship_from: z.object({ address: z.string() }).optional(),
  ship_to: z.object({ address: z.string() }).optional(),
  package_status: z.array(z.object({ datetime: z.string(), status: z.string() })).optional(),
  payment: z
    .object({ currency: z.literal("NGN"), shipping_fee: z.number().nonnegative() })
    .optional(),
});
export function mapShipment(value: unknown): TrackedShipment {
  const data = trackingSchema.parse(value);
  return {
    observedAt: data.package_status?.at(-1)?.datetime,
    id: data.order_id,
    status: data.status,
    trackingUrl: data.tracking_url?.startsWith("https://") ? data.tracking_url : undefined,
    courier: data.courier.name,
    pickupAddress: data.ship_from?.address,
    destinationAddress: data.ship_to?.address,
    shippingMinor: data.payment ? BigInt(Math.round(data.payment.shipping_fee * 100)) : undefined,
  };
}
export class Shipbubble implements ShippingProvider {
  constructor(private readonly request: typeof fetch = fetch) {}
  private async call(path: string, method = "GET", body?: unknown): Promise<any> {
    const c = getConfig();
    if (!c.DELIVERY_ENABLED || !c.SHIPBUBBLE_API_KEY)
      throw new AppError(503, "DELIVERY_UNAVAILABLE", "Delivery integration is not configured");
    if (c.SHIPBUBBLE_MODE === "test" && !c.SHIPBUBBLE_TEST_KEY_CONFIRMED)
      throw new AppError(503, "TEST_KEY_REQUIRED", "Configure a Shipbubble test key for test mode");
    const response = await this.request(`https://api.shipbubble.com/v1${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${c.SHIPBUBBLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok)
      throw new AppError(502, "SHIPBUBBLE_REQUEST_FAILED", "Delivery provider request failed");
    const envelope = await response.json();
    if (envelope.status !== "success")
      throw new AppError(
        502,
        "SHIPBUBBLE_REQUEST_FAILED",
        "Delivery provider could not complete the request",
      );
    return envelope.data;
  }
  async validateAddress(contact: Contact) {
    return z
      .object({ address_code: z.number().int() })
      .parse(await this.call("/shipping/address/validate", "POST", contact)).address_code;
  }
  async quotes(input: {
    pickup: Contact;
    destination: Contact;
    parcel: Parcel;
    name: string;
    valueMinor: bigint;
  }) {
    const c = getConfig();
    if (!c.SHIPBUBBLE_CATEGORY_ID)
      throw new AppError(
        503,
        "CATEGORY_REQUIRED",
        "Configure the confirmed Shipbubble produce category",
      );
    const [sender, receiver] = await Promise.all([
      this.validateAddress(input.pickup),
      this.validateAddress(input.destination),
    ]);
    const data = z
      .object({
        request_token: z.string(),
        couriers: z.array(
          z.object({
            courier_id: z.union([z.string(), z.number()]).transform(String),
            connected_account: z.boolean().optional(),
            currency: z.literal("NGN").optional(),
            rate_card_amount: z.number().nonnegative().optional(),
            service_code: z.string(),
            courier_name: z.string(),
            total: z.number().nonnegative().max(10000000),
            service_type: z.string(),
            delivery_eta: z.string().optional(),
            delivery_eta_time: z.string().optional(),
          }),
        ),
      })
      .parse(
        await this.call("/shipping/fetch_rates", "POST", {
          sender_address_code: sender,
          reciever_address_code: receiver,
          pickup_date: input.parcel.pickupDate,
          category_id: c.SHIPBUBBLE_CATEGORY_ID,
          package_items: [
            {
              name: input.name,
              description: input.name,
              quantity: 1,
              unit_amount: Number(input.valueMinor) / 100,
              unit_weight: input.parcel.weightKg,
            },
          ],
          package_dimension: {
            length: input.parcel.length,
            width: input.parcel.width,
            height: input.parcel.height,
          },
        }),
      );
    return data.couriers
      .filter(
        (x) =>
          x.service_type === "pickup" &&
          !x.connected_account &&
          (x.rate_card_amount === undefined || x.rate_card_amount === x.total),
      )
      .map((x) => ({
        courierId: x.courier_id,
        walletMinor: BigInt(Math.round(x.total * 100)),
        requestToken: data.request_token,
        serviceCode: x.service_code,
        courier: x.courier_name,
        amountMinor: BigInt(Math.round(x.total * 100)),
        eta: x.delivery_eta || x.delivery_eta_time,
      }));
  }
  async book(quote: Pick<ShippingRate, "requestToken" | "serviceCode" | "courierId">) {
    const c = getConfig();
    if (c.SHIPBUBBLE_MODE === "live" && !c.DELIVERY_LIVE_BOOKINGS)
      throw new AppError(503, "LIVE_BOOKING_DISABLED", "Live delivery booking is disabled");
    return mapShipment(
      await this.call("/shipping/labels", "POST", {
        request_token: quote.requestToken,
        service_code: quote.serviceCode,
        courier_id: quote.courierId,
      }),
    );
  }
  async wallet(): Promise<bigint> {
    const data = await this.call("/shipping/wallet/balance");
    const value = z.object({ balance: z.number().nonnegative() }).parse(data).balance;
    return BigInt(Math.round(value * 100));
  }
  async track(id: string) {
    const data = z
      .array(z.unknown())
      .parse(await this.call(`/shipping/labels/list/${encodeURIComponent(id)}`));
    const shipment = data.map(mapShipment).find((x) => x.id === id);
    if (!shipment) throw new AppError(404, "SHIPMENT_NOT_FOUND", "Provider shipment not found");
    return shipment;
  }
  async cancel(id: string) {
    await this.call(`/shipping/labels/cancel/${encodeURIComponent(id)}`, "POST");
  }
}
