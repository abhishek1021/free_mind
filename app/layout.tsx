import type { Metadata, Viewport } from "next";
import { Geist, Roboto } from "next/font/google";
import "./globals.css";

const geist  = Geist({ subsets: ["latin"], variable: "--font-geist" });
const roboto = Roboto({ subsets: ["latin"], weight: ["300", "400", "500", "700"], variable: "--font-roboto" });

export const metadata: Metadata = {
  title: "Free Mind",
  description: "Mindful scrolling — facts, riddles, life hacks & more",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Free Mind",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f0f0f",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${roboto.variable} h-full`}>
      <body className={`${roboto.className} h-full bg-[#0B0B18] antialiased`}>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');`,
          }}
        />
      </body>
    </html>
  );
}
