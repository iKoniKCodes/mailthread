import "./styles.css";

export const metadata = {
  title: "Mailthread",
  description: "Your Gmail conversations in one inbox",
  applicationName: "Mailthread",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Mailthread", statusBarStyle: "default" },
};

export const viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#f6f8fc" };

export default function Layout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
