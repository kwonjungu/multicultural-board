/** @type {import('next').NextConfig} */
const nextConfig = {
  // 연구대회 USB 포터블 실행용: server.js + 최소 의존성만 담긴 self-contained 빌드
  output: "standalone",
  experimental: {
    serverComponentsExternalPackages: ["firebase-admin", "pdf-parse"],
  },
  webpack: (config, { webpack, isServer }) => {
    // pdf-parse optionally requires canvas; disable it to avoid build warnings
    config.resolve.alias.canvas = false;

    if (!isServer) {
      // pptxgenjs(동적 import)가 node:fs / node:https 를 참조한다. 브라우저 빌드는
      // 이를 쓰지 않으므로 node: 스킴 prefix 를 벗겨내고 코어 모듈을 빈 모듈로 폴백.
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^node:/, (resource) => {
          resource.request = resource.request.replace(/^node:/, "");
        }),
      );
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        https: false,
        http: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
