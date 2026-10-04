import type { Metadata, Viewport } from "next";
import { Nav } from "@/components/nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "TripDeal — book travel packages with AI",
  description: "Find and book travel packages from trusted companies by chatting with an AI assistant.",
  applicationName: "TripDeal",
  appleWebApp: { capable: true, title: "TripDeal", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#0b74c9",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <Nav />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))]">{children}</main>
      </body>
    </html>
  );
}
