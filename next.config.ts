import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Learn-video attachments allow uploads up to 25 MB. The framework
      // default of 1 MB causes the Server Action body parser to reject
      // anything larger before our own size guard runs, crashing the page.
      bodySizeLimit: "30mb",
    },
  },
};

export default nextConfig;
