import { evaluateInPage, newSwiggyPage } from "./browser.js";

export function parseDishDescription(description) {
  const normalized = description.replace(/\s+/g, " ").trim();
  const kindMatch = /^(Veg Item|Non-veg item)\.\s*/i.exec(normalized);
  const withoutKind = kindMatch ? normalized.slice(kindMatch[0].length) : normalized;
  const priceMatch = /Costs:\s*([\d.]+)\s*rupees/i.exec(normalized);
  const name = withoutKind
    .split(/\.\s*(?:This item\b|Costs:|Swipe right\b)/i, 1)[0]
    .trim();

  return {
    name,
    vegetarian: kindMatch ? /^Veg Item$/i.test(kindMatch[1]) : null,
    price: priceMatch ? Number(priceMatch[1]) : null,
  };
}

export function parseRestaurantHeader(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines[0]?.toLowerCase() === "ad") lines.shift();
  const name = lines[0] ?? "Unknown restaurant";
  const details = lines.slice(1).join(" ");
  const ratingMatch = /([0-5](?:\.\d)?)\s*\(/.exec(details);
  const etaMatch = /([\d-]+\s*mins?)/i.exec(details);
  return {
    name,
    rating: ratingMatch ? Number(ratingMatch[1]) : null,
    eta: etaMatch?.[1] ?? null,
  };
}

export async function search(query, limit = 10) {
  const pageId = await newSwiggyPage(`/search?query=${encodeURIComponent(query)}`);
  const raw = await evaluateInPage(
    pageId,
    `async () => {
      const deadline = Date.now() + 30000;
      while (!document.querySelector('[data-testid="normal-dish-item"]')) {
        if (Date.now() > deadline) throw new Error('Timed out waiting for Swiggy dishes.');
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      return [...document.querySelectorAll('[data-testid="normal-dish-item"]')]
        .slice(0, ${limit})
        .map((card) => {
        const description = card.querySelector("p")?.textContent?.trim() ?? "";
        let group = card.parentElement;
        let restaurantLink = null;
        while (group && !restaurantLink) {
          restaurantLink = group.querySelector('a[href*="/city/"]');
          group = group.parentElement;
        }
        return {
          description,
          text: card.innerText,
          restaurantText: restaurantLink?.innerText ?? "",
          restaurantUrl: restaurantLink?.href ?? null,
        };
      });
    }`,
    45_000,
  );

  return raw.map((entry) => {
    const dish = parseDishDescription(entry.description);
    const restaurant = parseRestaurantHeader(entry.restaurantText);
    const lines = entry.text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const nameIndex = lines.findIndex((line) => line === dish.name);
    const possibleRating = nameIndex >= 0 ? Number(lines[nameIndex + 1]) : Number.NaN;
    return {
      ...dish,
      rating: Number.isFinite(possibleRating) ? possibleRating : null,
      restaurant: restaurant.name,
      restaurantRating: restaurant.rating,
      eta: restaurant.eta,
      restaurantUrl: entry.restaurantUrl,
    };
  });
}

export async function setLocation(location) {
  const pageId = await newSwiggyPage("/");
  const result = await evaluateInPage(
    pageId,
    `async () => {
      const locationText = ${JSON.stringify(location)};
      const deadline = Date.now() + 20000;
      let input;
      while (!(input = document.querySelector('input[name="location"]'))) {
        if (Date.now() > deadline) throw new Error('Location input did not appear.');
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      input.click();
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(input, locationText);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      const needle = locationText.split(/[ ,]/, 1)[0].toLowerCase();
      while (Date.now() <= deadline) {
        const choice = [...document.querySelectorAll('[role="button"]')].find((element) => {
          const text = (element.innerText || '').trim().toLowerCase();
          return text.includes(needle) && !text.includes('current location');
        });
        if (choice) {
          const selected = choice.innerText.trim().replace(/\\s+/g, ' ');
          choice.click();
          await new Promise((resolve) => setTimeout(resolve, 2000));
          return selected;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      throw new Error('No matching Swiggy location suggestion appeared.');
    }`,
    30_000,
  );
  return result;
}

export async function addItem(query, itemName, restaurantName) {
  const pageId = await newSwiggyPage(`/search?query=${encodeURIComponent(query)}`);
  return evaluateInPage(
    pageId,
    `async () => {
      const itemNeedle = ${JSON.stringify(itemName.toLowerCase())};
      const restaurantNeedle = ${JSON.stringify(restaurantName?.toLowerCase() ?? null)};
      const deadline = Date.now() + 30000;
      while (!document.querySelector('[data-testid="normal-dish-item"]')) {
        if (Date.now() > deadline) throw new Error('Timed out waiting for Swiggy dishes.');
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      const cards = [...document.querySelectorAll('[data-testid="normal-dish-item"]')];
      for (const card of cards) {
        if (!(card.innerText || '').toLowerCase().includes(itemNeedle)) continue;
        if (restaurantNeedle) {
          const restaurant = (() => {
            let element = card.parentElement;
            while (element) {
              const link = element.querySelector('a[href*="/city/"]');
              if (link) return link.innerText;
              element = element.parentElement;
            }
            return '';
          })();
          if (!restaurant.toLowerCase().includes(restaurantNeedle)) continue;
        }
        const button = [...card.querySelectorAll('button')].find((candidate) =>
          /^add$/i.test((candidate.innerText || '').trim()) && candidate.offsetParent !== null
        );
        if (!button) continue;
        button.click();
        await new Promise((resolve) => setTimeout(resolve, 1500));
        return {
          item: ${JSON.stringify(itemName)},
          needsCustomization: [...document.querySelectorAll('body *')].some((element) =>
            /customi[sz]e|choose.*option|required/i.test(element.innerText || '') &&
            element.offsetParent !== null
          ),
        };
      }
      throw new Error('Could not find the requested addable item.');
    }`,
    45_000,
  );
}
