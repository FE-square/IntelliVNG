/** @type {import('next').NextConfig} */
const nextConfig = {
    transpilePackages: [
        "@vng/ui",
        "@vng/editor",
        "@vng/player",
        "@vng/core",
    ],
}

module.exports = nextConfig
