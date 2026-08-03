import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Les photos prises au téléphone pèsent souvent 3 à 6 Mo : la limite
    // par défaut des Server Actions (1 Mo) les rejetait à l'envoi.
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default nextConfig;
