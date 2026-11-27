import { withPublicPage } from "./browser.js";
import { serviceUrl } from "./services.js";

function compact(value) {
  return value.replace(/\s+/g, " ").trim();
}

export function parseZomatoCard(text, url) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const ratingIndex = lines.findIndex((line) => /^[0-5](?:\.\d)?$/.test(line));
  return {
    name: lines[0] ?? "Unknown restaurant",
    rating: ratingIndex >= 0 ? Number(lines[ratingIndex]) : null,
    cuisines: ratingIndex >= 0 ? lines[ratingIndex + 1] ?? null : null,
    price: lines.find((line) => /₹.*for one/i.test(line)) ?? null,
    eta: lines.find((line) => /\d+\s*[–-]\s*\d+\s*min/i.test(line)) ?? null,
    url,
  };
}

export function parseBlinkitCard(text, id) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^ADD$/i.test(line));
  const etaIndex = lines.findIndex((line) => /\bMINS?\b/i.test(line));
  const priceIndex = lines.findIndex((line) => /^₹[\d,]+/.test(line));
  return {
    id,
    name: lines[etaIndex + 1] ?? lines[0] ?? "Unknown product",
    quantity: priceIndex > 0 ? lines[priceIndex - 1] : null,
    price: priceIndex >= 0 ? lines[priceIndex] : null,
    eta: etaIndex >= 0 ? lines[etaIndex] : null,
  };
}

async function listDelivery(options) {
  const url = serviceUrl("delivery", options);
  return withPublicPage(url, async (page) => {
    await page.locator('a[href*="/order"]').first().waitFor({ timeout: 20_000 });
    const raw = await page.locator('a[href*="/order"]').evaluateAll((anchors) => {
      const longestByUrl = new Map();
      for (const anchor of anchors) {
        const text = anchor.innerText.trim();
        const previous = longestByUrl.get(anchor.href);
        if (!previous || text.length > previous.length) longestByUrl.set(anchor.href, text);
      }
      return [...longestByUrl].map(([href, text]) => ({ href, text }));
    });
    return raw.map((entry) => parseZomatoCard(entry.text, entry.href));
  });
}

async function listDistrict(options) {
  const url = serviceUrl("district", options);
  return withPublicPage(url, async (page) => {
    const section = options.section === "for-you" || !options.section ? "dining" : options.section;
    const namedCards = page.locator('a[itemprop="url"]');
    const selector = (await namedCards.count()) > 0
      ? 'a[itemprop="url"]'
      : `a[href*="/${section}/"]`;
    const raw = await page.locator(selector).evaluateAll((anchors, activeSection) => {
      const unique = new Map();
      for (const anchor of anchors) {
        if (anchor.pathname === `/${activeSection}/`) continue;
        const lines = anchor.innerText
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean);
        const semanticName = anchor.querySelector('[itemprop="name"]')?.textContent?.trim();
        const imageName = [...anchor.querySelectorAll("img[alt]")]
          .map((image) => image.alt.trim())
          .find(Boolean);
        const textName = lines.find((line) =>
          !/^\d{1,2}:\d{2}\s*(?:AM|PM)$/i.test(line) &&
          !/^(?:book|buy|view|explore|know more)$/i.test(line),
        );
        const name = semanticName || textName || imageName;
        if (!name) continue;
        const details = lines.join(" ");
        const previous = unique.get(anchor.href);
        if (!previous || semanticName) unique.set(anchor.href, { name, details });
      }
      return [...unique].map(([href, value]) => ({ href, ...value }));
    }, section);
    return raw.map((entry) => ({
      name: entry.name,
      details: compact(entry.details) === entry.name ? "" : compact(entry.details),
      url: entry.href,
    }));
  });
}

async function listBlinkit(options) {
  const url = serviceUrl("blinkit", options);
  return withPublicPage(url, async (page) => {
    await page.locator('div[role="button"][id]').first().waitFor({ timeout: 20_000 });
    const raw = await page.locator('div[role="button"][id]').evaluateAll((cards) =>
      cards
        .filter((card) => /^\d+$/.test(card.id) && /\bADD\b/i.test(card.innerText))
        .map((card) => ({ id: card.id, text: card.innerText })),
    );
    return raw.map((entry) => parseBlinkitCard(entry.text, entry.id));
  });
}

export async function listService(service, options = {}) {
  switch (service) {
    case "delivery":
    case "zomato":
      return listDelivery(options);
    case "district":
      return listDistrict(options);
    case "blinkit":
      return listBlinkit(options);
    default:
      throw new Error(`Unknown service "${service}".`);
  }
}
