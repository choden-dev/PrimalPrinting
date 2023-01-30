/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  swcMinify: true,

}

module.exports = {
  i18n: {
    locales: ['en'],
    defaultLocale: 'en',
  },
}
