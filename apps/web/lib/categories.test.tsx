import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { Categories } from "../components/admin/categories";
it("shows editable multilingual categories, order, usage counts and availability", () => {
  const html = renderToStaticMarkup(
    <Categories
      items={[
        {
          id: "category",
          slug: "vegetables",
          isActive: false,
          sortOrder: 4,
          translations: [{ locale: "en", name: "Vegetables" }],
          _count: { listings: 12 },
        },
      ]}
      request={async () => ({})}
      reload={async () => {}}
    />,
  );
  for (const text of [
    "Vegetables",
    "Inactive",
    "Display order",
    "English (required)",
    "Igbo (optional)",
    "existing listings and orders are preserved",
    "Edit vegetables",
  ])
    expect(html).toContain(text);
  expect(html).not.toContain("Delete category");
});
