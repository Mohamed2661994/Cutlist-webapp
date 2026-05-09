import type { Metadata } from "next";

import "../src/index.css";

export const metadata: Metadata = {
  title: "Cabinet Cut Optimizer",
  description:
    "Cabinet cut list optimizer with sheet layout planning and 3D preview.",
  applicationName: "Cabinet Cut Optimizer",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Cutlist",
  },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: "/favicon.svg",
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
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
