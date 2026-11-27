import assert from "node:assert/strict";
import test from "node:test";

import { parseBlinkitCard, parseZomatoCard } from "../src/list.js";
import { blinkitUrl, deliveryUrl, districtUrl } from "../src/services.js";

test("builds observed service routes", () => {
  assert.equal(deliveryUrl("Bangalore"), "https://www.zomato.com/bangalore/delivery");
  assert.equal(
    deliveryUrl("Bangalore", "Woodfired Pizza"),
    "https://www.zomato.com/bangalore/delivery/dish-woodfired-pizza",
  );
  assert.equal(districtUrl("movies"), "https://www.district.in/movies/");
  assert.equal(blinkitUrl("white butter"), "https://blinkit.com/s/?q=white%20butter");
});

test("parses a Zomato restaurant card", () => {
  assert.deepEqual(
    parseZomatoCard(
      "Blue Tokai Coffee Roasters\n4.5\nCafe, Coffee, Beverages\n₹200 for one\n20–25 min",
      "https://www.zomato.com/example/order",
    ),
    {
      name: "Blue Tokai Coffee Roasters",
      rating: 4.5,
      cuisines: "Cafe, Coffee, Beverages",
      price: "₹200 for one",
      eta: "20–25 min",
      url: "https://www.zomato.com/example/order",
    },
  );
});

test("parses a Blinkit product card", () => {
  assert.deepEqual(parseBlinkitCard("19 MINS\nSalted Butter\n100 g\n₹66\nADD", "123"), {
    id: "123",
    name: "Salted Butter",
    quantity: "100 g",
    price: "₹66",
    eta: "19 MINS",
  });
});
