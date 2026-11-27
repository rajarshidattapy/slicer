export const DISTRICT_SECTIONS = new Set([
  "for-you",
  "dining",
  "movies",
  "events",
  "stores",
  "activities",
  "play",
]);

export function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function deliveryUrl(location = "bangalore", dish) {
  const locationSlug = slugify(location) || "bangalore";
  const base = `https://www.zomato.com/${locationSlug}/delivery`;
  return dish ? `${base}/dish-${slugify(dish)}` : base;
}

export function districtUrl(section = "for-you") {
  const normalized = slugify(section) || "for-you";
  if (!DISTRICT_SECTIONS.has(normalized)) {
    throw new Error(
      `Unknown District section "${section}". Choose: ${[...DISTRICT_SECTIONS].join(", ")}.`,
    );
  }
  return normalized === "for-you"
    ? "https://www.district.in/"
    : `https://www.district.in/${normalized}/`;
}

export function blinkitUrl(query) {
  return query
    ? `https://blinkit.com/s/?q=${encodeURIComponent(query.trim())}`
    : "https://blinkit.com/";
}

export function serviceUrl(service, options = {}) {
  switch (service) {
    case "delivery":
    case "zomato":
      return deliveryUrl(options.location, options.query);
    case "district":
      return districtUrl(options.section);
    case "blinkit":
      return blinkitUrl(options.query);
    default:
      throw new Error(`Unknown service "${service}". Choose delivery, district, or blinkit.`);
  }
}
