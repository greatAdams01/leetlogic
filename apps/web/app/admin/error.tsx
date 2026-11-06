"use client";
import { PageError, type PageErrorProps } from "../../components/page-error";
export default function AdminError(props: PageErrorProps) {
  return <PageError {...props} staff />;
}
