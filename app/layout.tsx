import type { Metadata } from "next";

import "../src/index.css";

export const metadata: Metadata = {
  title: "Cabinet Cut Optimizer",
  description:
    "Cabinet cut list optimizer with sheet layout planning and 3D preview.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
