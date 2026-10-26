import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ListingQueue, ListingReview, listingPrice } from "../components/admin/listing-review";
const listing = {
  id: "listing",
  title: "Fresh tomatoes",
  description: "Harvested today",
  sourceLocale: "ig",
  status: "PENDING_REVIEW",
  unitPriceMinor: "123456",
  availableQuantity: "10",
  reservedQuantity: "2",
  unitCode: "KG",
  unit: { name: "Kilogram" },
  category: { translations: [{ locale: "en", name: "Vegetables" }] },
  locationAddress: { line1: "Farm road", city: "Ibadan", lga: "Ibadan North", state: "Oyo" },
  shippingScope: "LOCAL",
  farmerProfile: {
    farmName: "Example farm",
    verificationStatus: "APPROVED",
    user: {
      status: "ACTIVE",
      phoneE164: "+2348000000000",
      profile: { fullName: "Example farmer" },
    },
  },
  media: [
    { id: "second", displayOrder: 1, objectKey: "produce/22222222-2222-4222-8222-222222222222" },
    { id: "first", displayOrder: 0, objectKey: "produce/11111111-1111-4111-8111-111111111111" },
  ],
};
const review = (record = listing, canDecide = true) =>
  renderToStaticMarkup(
    <ListingReview record={record} busy={false} canDecide={canDecide} onStatus={() => {}} />,
  );
describe("admin listing review", () => {
  it("shows produce, stock, farm details and ordered authenticated photos", () => {
    const html = review();
    for (const text of [
      "Fresh tomatoes",
      "Harvested today",
      "Vegetables",
      "Example farm",
      "Example farmer",
      "Farm road",
      "Within the farm’s state",
      "Igbo",
      "₦1,234.56",
    ])
      expect(html).toContain(text);
    expect(html.indexOf("/api/admin/produce-photos/11111111")).toBeLessThan(
      html.indexOf("/api/admin/produce-photos/22222222"),
    );
    expect(html).not.toContain("res.cloudinary.com");
  });
  it("does not offer publishing for unapproved farmers or allow actions on archived listings", () => {
    const html = review({
      ...listing,
      farmerProfile: { ...listing.farmerProfile, verificationStatus: "SUBMITTED" },
    });
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Approve listing/);
    const archived = review({ ...listing, status: "ARCHIVED" });
    expect(archived).not.toContain(">Approve listing</button>");
    expect(archived).not.toContain(">Archive listing</button>");
    expect(review(listing, false)).not.toContain(">Approve listing</button>");
  });
  it("shows readable queue rows and a neutral state for missing photos", () => {
    const html = renderToStaticMarkup(
      <ListingQueue
        items={[{ ...listing, media: [] }]}
        selectedId="listing"
        busy={false}
        onReview={() => {}}
      />,
    );
    expect(html).toContain("listing-row-selected");
    expect(html).toContain("10 in stock");
    expect(html).toContain("No preview");
    expect(html).toContain("Review Fresh tomatoes");
  });
  it("preserves minor-unit precision for large prices", () => {
    expect(listingPrice("999999999999")).toBe("₦9,999,999,999.99");
  });
});
