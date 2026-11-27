import assert from "node:assert/strict";
import test from "node:test";

import { parseDishDescription, parseRestaurantHeader } from "../src/swiggy.js";

test("parses a vegetarian dish accessibility description", () => {
  assert.deepEqual(
    parseDishDescription(
      "Veg Item. Margherita. This item is a BESTSELLER, Costs: 149 rupees, Swipe right to add item to cart.",
    ),
    { name: "Margherita", vegetarian: true, price: 149 },
  );
});

test("parses a non-vegetarian dish", () => {
  assert.deepEqual(
    parseDishDescription(
      "Non-veg item. Chicken Sausage Pizza. Costs: 355 rupees, Swipe right to add item to cart.",
    ),
    { name: "Chicken Sausage Pizza", vegetarian: false, price: 355 },
  );
});

test("parses restaurant name, rating, and ETA", () => {
  assert.deepEqual(parseRestaurantHeader("Ad\nPizza Hut\n4.0 (14k+) • 45-50 mins"), {
    name: "Pizza Hut",
    rating: 4,
    eta: "45-50 mins",
  });
});
