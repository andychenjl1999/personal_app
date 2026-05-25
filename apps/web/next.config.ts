const path = require('node:path');

const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: path.join(__dirname, '../..'),
  },
};

module.exports = nextConfig;
