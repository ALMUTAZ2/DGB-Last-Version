const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Changes the cache location for Puppeteer to reside within the project directory.
  // This makes it extremely reliable for cloud platforms like Render where global cache directories are lost or inaccessible.
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
