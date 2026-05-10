import type { Metadata } from "next";
import { Bebas_Neue, Montserrat } from "next/font/google";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import "./globals.css";

const bebas = Bebas_Neue({
  weight: "400",
  variable: "--font-bebas",
  subsets: ["latin"],
});

const montserrat = Montserrat({
  weight: ["400", "500", "600", "700"],
  variable: "--font-montserrat",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.dashboardcomercialsusazon.com"),
  title: "InCom · Dashboard Comercial Susazón",
  description:
    "Inteligencia Comercial — monitoreo de ventas, márgenes y volúmenes por territorio. Plataforma de uso restringido para personal autorizado.",
  applicationName: "InCom · Dashboard Comercial Susazón",
  authors: [{ name: "Grupo Susazón" }],
  keywords: ["dashboard", "ventas", "Susazón", "InCom", "inteligencia comercial"],
  robots: { index: false, follow: false },
  // Next.js 16 detecta automáticamente app/icon.png, app/apple-icon.png,
  // app/opengraph-image.png y app/twitter-image.png. No hace falta declarar
  // explícitamente icons aquí; el File-based Metadata API genera los
  // <link rel="icon"> y <meta property="og:image"> al build.
  openGraph: {
    type: "website",
    locale: "es_MX",
    url: "https://www.dashboardcomercialsusazon.com",
    title: "InCom · Dashboard Comercial Susazón",
    description:
      "Inteligencia Comercial — monitoreo de ventas, márgenes y volúmenes por territorio.",
    siteName: "InCom",
  },
  twitter: {
    card: "summary_large_image",
    title: "InCom · Dashboard Comercial Susazón",
    description:
      "Inteligencia Comercial — monitoreo de ventas, márgenes y volúmenes por territorio.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      data-theme="clean"
      className={`${bebas.variable} ${montserrat.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
