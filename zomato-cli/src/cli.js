#!/usr/bin/env node

import { createInterface } from "node:readline/promises";

import { openInDefaultChrome } from "./browser.js";
import { listService } from "./list.js";
import { DISTRICT_SECTIONS, serviceUrl } from "./services.js";

const HELP = `zomato - select Zomato Delivery, District, or Blinkit

Usage:
  zomato                              Interactive selector
  zomato delivery [--location CITY] [--search DISH] [--list] [--limit N] [--json]
  zomato district [--section NAME] [--list] [--limit N] [--json]
  zomato blinkit [--search PRODUCT] [--list] [--limit N] [--json]

Without --list, the selected service opens normally in your default Chrome.
--list uses a disposable public browser session and never logs in or modifies a cart.`;

function option(args, name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
}

function parseLimit(args) {
  const limit = Number(option(args, "--limit", "10"));
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error("--limit must be an integer from 1 to 100.");
  }
  return limit;
}

function normalizeService(value) {
  const normalized = value.trim().toLowerCase();
  if (["1", "zomato", "delivery"].includes(normalized)) return "delivery";
  if (["2", "district"].includes(normalized)) return "district";
  if (["3", "blinkit"].includes(normalized)) return "blinkit";
  throw new Error("Choose 1 (Zomato Delivery), 2 (District), or 3 (Blinkit).");
}

async function interactiveSelection() {
  if (!process.stdin.isTTY) throw new Error("Interactive mode requires a terminal.");
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    console.log("\nSelect a service:\n  1. Zomato Delivery\n  2. District\n  3. Blinkit\n");
    const service = normalizeService(await prompt.question("Service: "));
    const action = (await prompt.question("Action [open/list] (open): ")).trim() || "open";
    const options = {};
    if (service === "delivery") {
      options.location = (await prompt.question("Location (bangalore): ")).trim() || "bangalore";
      options.query = (await prompt.question("Dish/category (optional): ")).trim() || undefined;
    } else if (service === "district") {
      options.section =
        (await prompt.question(`Section [${[...DISTRICT_SECTIONS].join("/")}] (for-you): `)).trim() ||
        "for-you";
    } else {
      options.query = (await prompt.question("Product search (optional): ")).trim() || undefined;
    }
    return { service, action, options, limit: 10, json: false };
  } finally {
    prompt.close();
  }
}

function commandSelection(service, args) {
  return {
    service: normalizeService(service),
    action: args.includes("--list") ? "list" : "open",
    options: {
      location: option(args, "--location", "bangalore"),
      section: option(args, "--section", "for-you"),
      query: option(args, "--search"),
    },
    limit: parseLimit(args),
    json: args.includes("--json"),
  };
}

function printRows(service, rows) {
  if (rows.length === 0) {
    console.log("No public cards were found.");
    return;
  }
  rows.forEach((row, index) => {
    if (service === "delivery") {
      console.log(`${index + 1}. ${row.name}${row.rating == null ? "" : ` (rating ${row.rating})`}`);
      console.log(`   ${[row.cuisines, row.price, row.eta].filter(Boolean).join(" | ")}`);
    } else if (service === "blinkit") {
      console.log(`${index + 1}. ${row.name} - ${row.price ?? "price unavailable"}`);
      console.log(`   ${[row.quantity, row.eta].filter(Boolean).join(" | ")}`);
    } else {
      console.log(`${index + 1}. ${row.name}`);
      if (row.details) console.log(`   ${row.details}`);
    }
  });
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (["help", "--help", "-h"].includes(command)) {
    console.log(HELP);
    return;
  }

  const selection = command
    ? commandSelection(command, args)
    : await interactiveSelection();
  const url = serviceUrl(selection.service, selection.options);

  if (selection.action === "open") {
    await openInDefaultChrome(url);
    console.log(`Opened ${selection.service} in your default Chrome:\n${url}`);
    return;
  }
  if (selection.action !== "list") throw new Error("Action must be open or list.");

  const rows = (await listService(selection.service, selection.options)).slice(
    0,
    selection.limit,
  );
  if (selection.json) console.log(JSON.stringify(rows, null, 2));
  else printRows(selection.service, rows);
}

main().catch((error) => {
  console.error(`zomato: ${error.message}`);
  process.exitCode = 1;
});
