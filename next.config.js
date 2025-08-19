/** @type {import('next').NextConfig} */
const nextConfig = {
  // ✅ 本番では StrictMode 有効のままで OK
  reactStrictMode: true,

  // ✅ SWC による高速な minify（本番推奨）
  swcMinify: true,

  experimental: { esmExternals: "loose" },
  transpilePackages: ["@walletconnect/ethereum-provider"],

  // ✅ PDF.js 対応用などで canvas を外部参照
  webpack: (config) => {
    config.externals = [...(config.externals || []), { canvas: "canvas" }];
    return config;
  },

  // ✅ .env から使用するサーバー環境変数を明示
  env: {
    RELAYER_PRIVATE_KEY: process.env.RELAYER_PRIVATE_KEY,
    PGIRLSCHAIN_RPC_URL: process.env.PGIRLSCHAIN_RPC_URL,
    PGIRLS_BRIDGE_CONTRACT_ADDRESS: process.env.PGIRLS_BRIDGE_CONTRACT_ADDRESS,
    NEXT_PUBLIC_PGIRLS_CHAIN_ID: process.env.NEXT_PUBLIC_PGIRLS_CHAIN_ID,
    NEXT_PUBLIC_PGIRLSCHAIN_RPC_URL: process.env.NEXT_PUBLIC_PGIRLSCHAIN_RPC_URL,
    NEXT_PUBLIC_PGIRLS_EXPLORER_URL: process.env.NEXT_PUBLIC_PGIRLS_EXPLORER_URL,
  }
};

export default nextConfig;
