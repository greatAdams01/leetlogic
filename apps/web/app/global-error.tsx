"use client";
import { PageError, type PageErrorProps } from "../components/page-error";
export default function GlobalError(props: PageErrorProps) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#faf7f0" }}>
        <PageError {...props} />
      </body>
    </html>
  );
}
