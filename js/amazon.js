// amazon.js — Extract product info from Amazon URLs
// Amazon blocks CORS scraping, so we extract from the URL itself
// and use Amazon's predictable image URL pattern

/**
 * Extract ASIN from an Amazon URL
 */
function extractASIN(url) {
  const patterns = [
    /\/dp\/([A-Z0-9]{10})/i,
    /\/gp\/product\/([A-Z0-9]{10})/i,
    /\/product\/([A-Z0-9]{10})/i,
    /asin=([A-Z0-9]{10})/i,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Extract a readable product name from Amazon URL slug
 */
function extractNameFromURL(url) {
  try {
    const path = new URL(url).pathname;
    // URLs look like /Product-Name-Here/dp/ASIN
    const slug = path.split('/dp/')[0]?.split('/').filter(Boolean).pop();
    if (!slug || slug.length < 3) return '';

    // Convert URL slug to readable name
    return slug
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();
  } catch {
    return '';
  }
}

/**
 * Try to get the product image via Amazon's image endpoint
 * Amazon images follow: https://m.media-amazon.com/images/I/{imageId}._AC_SL{size}_.jpg
 * We can try to load the default product image via the ASIN
 */
async function tryLoadImage(asin) {
  // Amazon's standard product image URLs
  const candidates = [
    `https://m.media-amazon.com/images/P/${asin}.01._SCLZZZZZZZ_SX300_.jpg`,
    `https://images-na.ssl-images-amazon.com/images/P/${asin}.01._SCLZZZZZZZ_SX300_.jpg`,
  ];

  for (const url of candidates) {
    try {
      const works = await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img.naturalWidth > 1);
        img.onerror = () => resolve(false);
        img.src = url;
        setTimeout(() => resolve(false), 4000);
      });
      if (works) return url;
    } catch {
      continue;
    }
  }
  return '';
}

/**
 * Main function — extract what we can from an Amazon URL
 * Returns { name, imageUrl, asin } — always returns something useful
 */
async function fetchAmazonProduct(url) {
  if (!url) return null;

  const isAmazon = url.includes('amazon.com') || url.includes('amzn.');
  if (!isAmazon) return null;

  const asin = extractASIN(url);
  const name = extractNameFromURL(url);
  let imageUrl = '';

  if (asin) {
    imageUrl = await tryLoadImage(asin);
  }

  return {
    name: name || '',
    imageUrl: imageUrl || '',
    price: '',
    description: asin ? `ASIN: ${asin}` : '',
  };
}

export { fetchAmazonProduct, extractASIN };
