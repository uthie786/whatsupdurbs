import type { Metadata } from "next";
import { Archivo_Black, Space_Grotesk } from "next/font/google";
import "leaflet/dist/leaflet.css";
import "./globals.css";

const display = Archivo_Black({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
});

const body = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "WhatsUpDurbs 🌊 | Durban Events, Markets, Pop-ups & Festivals",
  description:
    "The loudest guide to what's happening in Durban — markets, concerts, pop-ups, nightlife and festive season events from Umhlanga to the Point.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable} font-sans`}>
        {children}
      </body>
    </html>
  );
}
