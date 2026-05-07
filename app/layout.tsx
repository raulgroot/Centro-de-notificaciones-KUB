import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";

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
    <html lang="es" className={`${mono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-white font-sans text-neutral-900">
        {children}
      </body>
    </html>
  );
}
