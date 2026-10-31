# Shipping checkout and provider boundaries

## Regression and repair

The old eligibility condition sent every shipment with more than one parcel, or over a default 20 kg, to staff review. Buyer-entered measurements were also used in quotations even when the farmer had supplied packing information.

Quotes now derive parcel count, gross weight, per-parcel dimensions, volume and required handling from the saved order snapshot. A 50 kg selling bag with 0.5 kg packaging weighs 50.5 kg; two ordered bags produce two parcels totaling 101 kg. Buyers choose the destination and pickup date; they cannot reduce shipment requirements.

The existing courier cards, recommendation ranking, selected quote and Bachs checkout remain the checkout path. A supported delivery goes from address review to live options, order summary and payment without staff price approval. An unsupported shipment or empty provider result returns an actionable error rather than silently entering manual review. Historical manual arrangements remain supported for staff operations.

## What Shipbubble actually supports

The [rates API](https://docs.shipbubble.com/api-reference/rates/request-shipping-rates) offers courier services, not named riders or verified vehicle payloads. The [shipment API](https://docs.shipbubble.com/api-reference/shipments/create-shipment) routes a selected quote to the courier. These APIs do not support choosing a named rider before payment. [Bachs](https://docs.bachs.io/guides/checkout/checkout-sessions) supplies hosted checkout and payment confirmation, not a rider directory.

Accordingly, the UI continues to label these options as courier services. A returned quote confirms a courier offer for the submitted parcel; it is not evidence of an individual vehicle's certified payload. Individual rider selection and vehicle-capacity certification require a provider exposing that data and a booking API that guarantees the selected rider. Do not invent rider names or map a courier quote to an arbitrary vehicle.

Automatic quoting currently supports STANDARD handling only. Cold chain, perishability, special handling flags, unsupported routes, missing measurements, and loads outside configured limits are rejected before payment. Free-text handling notes and pickup instructions are transmitted to Shipbubble; structured special requirements are never silently downgraded to STANDARD. No weight, dimensions, container tare, oil density, or rider capacity is guessed from a crop name.

## Multiple parcels and sellers

Shipbubble accepts one package dimension per rates request. For up to 20 identical farmer-packed parcels, the adapter obtains a separate real quote token for each parcel, offers only courier/service combinations present in every response, and sums the fees exactly. Declared product value is divided in integer kobo with the remainder preserved. Each parcel has its own label, persisted booking claim and tracking link. Different parcel contents and pickup locations continue to use the cart's separate per-listing orders, preventing accidental merging of different farms or incompatible loads. Separate orders require separate shipping selections and payments; consolidated multi-seller collection is not implemented.

An ambiguous outbound booking is never automatically replayed. Confirmed parcels remain recorded. If every provider booking is recorded but local finalization crashed, the worker can complete accounting without buying labels again. Otherwise staff must reconcile the uncertain parcel via the step-up protected parcel-link endpoint; a provider shipment ID cannot be reused across orders/parcels. The entire order is delivered only after all parcels are delivered. A mixed delivered/cancelled/returned result cannot authorize buyer confirmation or escrow release. Refunds require all booked parcels to have confirmed eligible terminal results, or proof that booking never started. Active checkout and settlement operations prevent conflicting delivery changes or new bookings.

An unexpected courier or individual parcel cost mismatch puts the order on financial hold, even if all parcel costs sum to the quoted total. Confirmed labels stay recorded and are not purchased again. Tracking and cancellation continue for the other known labels when one label fails; unresolved errors still block aggregate completion, and each cancellation write is attempted at most once.

## Farmer workflow and existing listings

Step 4 retains the existing category-dependent selling package selector. For known KG selling sizes, the packing form displays nominal produce weight and asks for additional packaging weight instead of asking the farmer to enter the nominal weight again. Piece-based and liquid products still require actual gross weight; litres are never treated as kilograms. All parcel dimensions remain explicit measurements. Structured handling and optional pickup instructions are saved with packaging.

My Listings exposes Edit shipping details, including for legacy listings missing measurements. Ownership, positive measurements, integer package units where required, and minimum produce weight are checked by the server. Active moderation requires valid packing. Existing populated order snapshots remain unchanged; new orders use the updated details. Old orders reserved without packing may need to be cancelled and placed again after the seller completes measurements.

## Deployment and operations

Build `@leetlogic/contracts`, apply `20261031180000_split_delivery_parcels` along with the existing packing/quality migrations, regenerate Prisma Client, then deploy API, worker and clients together. Retain separate Shipbubble and Bachs sandbox/live controls. `DELIVERY_MAX_WEIGHT_KG` is now an operational per-parcel ceiling with a default of 1000 kg, not a vehicle payload guarantee. Explicit environment values still override this default. The category/state allowlists, provider key mode, and Shipbubble package category must be configured for the intended rollout.

Specialized transport is unavailable until a suitable integration or confirmed service capability is added. Split shipment testing uses mocked providers and an isolated local PostgreSQL schema; it does not prove production carrier availability or make live payment/booking calls.
