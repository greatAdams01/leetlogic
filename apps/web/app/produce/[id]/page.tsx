import type { Metadata } from "next";
import { cache } from "react";
const read = cache(async (id: string) => {
  if (!/^[a-f0-9-]{36}$/i.test(id)) return null;
  try {
    const response = await fetch(
      `${process.env.ADMIN_API_URL || "http://localhost:3000"}/v1/marketplace/listings/${id}`,
      { cache: "no-store", signal: AbortSignal.timeout(10000) },
    );
    return response.ok ? (await response.json()).item : null;
  } catch {
    return null;
  }
});
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params,
    item = await read(id);
  if (!item) return { title: "Produce unavailable", robots: { index: false } };
  const photo = item.media?.[0]?.objectKey?.match(/^produce\/([a-f0-9-]{36})$/i)?.[1];
  return {
    title: item.title,
    description: item.description || `Produce from ${item.farmerProfile.farmName}`,
    alternates: { canonical: `/produce/${id}` },
    openGraph: {
      title: item.title,
      description: item.description || item.farmerProfile.farmName,
      url: `/produce/${id}`,
      ...(photo ? { images: [{ url: `/api/customer/listing-photos/${photo}` }] } : {}),
    },
  };
}
export default async function SharedProduce({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params,
    item = await read(id);
  return (
    <article style={{ maxWidth: 760, margin: "0 auto", padding: 24 }}>
      {!item ? (
        <>
          <h1>Produce unavailable</h1>
          <p>
            This listing may no longer be available. Check the LeetLogic app for current produce.
          </p>
        </>
      ) : (
        <>
          <h1>{item.title}</h1>
          <p>
            {item.farmerProfile.farmName} · {item.locationAddress.city},{" "}
            {item.locationAddress.state}
          </p>
          <div style={{ display: "grid", gap: 12 }}>
            {item.media?.map((photo: { objectKey: string }) => {
              const photoId = photo.objectKey.match(/^produce\/([a-f0-9-]{36})$/i)?.[1];
              return photoId ? (
                <a
                  key={photoId}
                  href={`/api/customer/listing-photos/${photoId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <img
                    src={`/api/customer/listing-photos/${photoId}`}
                    alt={item.title}
                    style={{
                      width: "100%",
                      maxHeight: 420,
                      objectFit: "contain",
                      borderRadius: 16,
                    }}
                  />
                </a>
              ) : null;
            })}
          </div>
          <p>{item.description}</p>
          <p>
            <strong>
              {new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(
                Number(item.unitPriceMinor) / 100,
              )}
            </strong>{" "}
            / {item.unitCode.toLowerCase()}
          </p>
          <p>
            View this produce in the LeetLogic app to choose a quantity and arrange delivery. Stock,
            pricing and delivery eligibility are confirmed before payment.
          </p>
        </>
      )}
    </article>
  );
}
