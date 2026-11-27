#!/usr/bin/env node

import {
  defaultChromeRemoteDebuggingEnabled,
  newSwiggyPage,
  openDefaultChrome,
  verifyDefaultChromeConnection,
  waitForEnter,
} from "./browser.js";
import { addItem, search, setLocation } from "./swiggy.js";

const HELP = `swiggy - control Swiggy through your running default Chrome profile

Usage:
  swiggy setup
  swiggy location <place>
  swiggy search <query> [--limit N] [--json]
  swiggy add <query> --item <name> [--restaurant <name>]
  swiggy cart
  swiggy checkout
  swiggy open [url]

Environment:
  SWIGGY_CHROME_PATH  Google Chrome executable override

The checkout command never submits an order or payment. It opens Swiggy so you
can review and explicitly complete the transaction yourself.`;

function option(args, name, fallback = undefined) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
}

function positional(args, excludedOptions = []) {
  const values = [];
  for (let index = 0; index < args.length; index += 1) {
    if (excludedOptions.includes(args[index])) {
      index += 1;
      continue;
    }
    if (!args[index].startsWith("--")) values.push(args[index]);
  }
  return values;
}

function printResults(results, json) {
  if (json) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }
  if (results.length === 0) {
    console.log("No dishes found.");
    return;
  }
  results.forEach((item, index) => {
    const price = item.price == null ? "price unavailable" : `₹${item.price}`;
    const rating = item.rating == null ? "" : ` ★${item.rating}`;
    const eta = item.eta ? ` • ${item.eta}` : "";
    console.log(`${index + 1}. ${item.name} — ${price}${rating}`);
    console.log(`   ${item.restaurant}${eta}`);
  });
}

async function main() {
  const [command = "help", ...args] = process.argv.slice(2);
  if (["help", "--help", "-h"].includes(command)) {
    console.log(HELP);
    return;
  }

  if (command === "setup") {
    if (!process.stdin.isTTY) throw new Error("setup requires an interactive terminal.");
    await openDefaultChrome("chrome://inspect/#remote-debugging");
    console.log("Opened Chrome's Remote Debugging settings in your Default profile.");
    console.log("Enable remote debugging on that page. Your cookies are not copied.");
    await waitForEnter(
      "After enabling it, press Enter here; then approve Chrome's connection prompt...",
    );
    const enabled = await defaultChromeRemoteDebuggingEnabled();
    if (enabled === false) {
      throw new Error(
        "Remote debugging is still OFF. On chrome://inspect/#remote-debugging, turn the switch ON, then run `swiggy setup` again.",
      );
    }
    const result = await verifyDefaultChromeConnection();
    console.log(`Connected to your default Chrome: ${result.title}`);
    return;
  }

  if (command === "location") {
    const place = positional(args).join(" ");
    if (!place) throw new Error("location requires a place name.");
    const selected = await setLocation(place);
    console.log(`Location set to: ${selected}`);
    return;
  }

  if (command === "search") {
    const query = positional(args, ["--limit"]).join(" ");
    if (!query) throw new Error("search requires a query.");
    const limit = Number(option(args, "--limit", "10"));
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new Error("--limit must be an integer from 1 to 100.");
    }
    const results = await search(query, limit);
    printResults(results, args.includes("--json"));
    return;
  }

  if (command === "add") {
    const query = positional(args, ["--item", "--restaurant"]).join(" ");
    const item = option(args, "--item");
    const restaurant = option(args, "--restaurant");
    if (!query || !item) throw new Error("add requires <query> and --item <name>.");
    const result = await addItem(query, item, restaurant);
    if (result.needsCustomization) {
      console.log("Swiggy requires customization; finish the choices in your Chrome tab.");
    } else {
      console.log(`Added to cart: ${result.item}`);
    }
    return;
  }

  if (["cart", "checkout"].includes(command)) {
    await newSwiggyPage("/checkout");
    console.log("Checkout is open in your default Chrome. Review the cart there.");
    console.log("This CLI will not click Place Order or submit payment.");
    return;
  }

  if (command === "open") {
    const target = positional(args)[0] ?? "https://www.swiggy.com/";
    await newSwiggyPage(target);
    console.log("Opened in your default Chrome.");
    return;
  }

  throw new Error(`Unknown command: ${command}\n\n${HELP}`);
}

main().catch((error) => {
  console.error(`swiggy: ${error.message}`);
  process.exitCode = 1;
});
