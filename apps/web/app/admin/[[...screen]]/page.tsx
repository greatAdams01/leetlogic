import { notFound } from "next/navigation";
import { adminScreens } from "../../../components/admin/screens";
import { AdminWorkspace } from "../../../components/admin/workspace";

type Props = { params: Promise<{ screen?: string[] }> };

export async function generateMetadata({ params }: Props) {
  const route = (await params).screen?.join("/") || "dashboard";
  const screen = adminScreens[route as keyof typeof adminScreens];
  return { title: screen?.title || "Staff operations" };
}

export default async function AdminPage({ params }: Props) {
  const route = (await params).screen?.join("/") || "dashboard";
  const screen = adminScreens[route as keyof typeof adminScreens];
  if (!screen) notFound();
  const Screen = screen.component;
  return (
    <AdminWorkspace route={route} title={screen.title}>
      <Screen />
    </AdminWorkspace>
  );
}
