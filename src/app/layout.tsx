import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Portal de Clientes Grupo Frío",
  description: "Haz tus pedidos, consulta tus compras y gana recompensas con Grupo Frío.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#0077BB",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;

}>) {
  return (
    <html lang="es" className="antialiased">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <div className="max-w-md mx-auto min-h-screen bg-background relative overflow-x-hidden shadow-2xl">
          {children}
        </div>
      </body>
    </html>
  );
}
