import type { Metadata } from "next";
import { Urbanist, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const urbanist = Urbanist({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Centro de notificaciones · Kublau",
  description: "Centralización, consulta y creación de notificaciones de Kublau.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${urbanist.variable} ${mono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-white font-sans text-neutral-900">
        {children}
      </body>
    </html>
  );
}
