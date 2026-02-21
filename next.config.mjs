/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api-proxy/:path*',
        destination: 'http://127.0.0.1:8000/:path*',
      },
    ]
  },
}

export default config
