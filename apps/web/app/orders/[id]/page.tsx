import { CustomerDelivery } from "../../../components/customer-delivery";
export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CustomerDelivery id={id} />;
}
