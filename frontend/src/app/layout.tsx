import type { Metadata } from "next";
import { AuthProvider } from "@/components/AuthProvider";

import "./globals.css";

export const metadata: Metadata = {
  title: "MOLTURA | Molienda Inteligente",
  description: "Sistema de gemelo digital y analitica avanzada para operaciones de molienda",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
