
import db from "./config/database.js";

const products = [
  {
    name: "Gentle Foaming Cleanser",
    description: "A gentle daily cleanser for clean, refreshed skin.",
    price: 39900,
    stock: 25,
    image_url: ""
  },
  {
    name: "Hydrating Face Moisturizer",
    description: "A lightweight moisturizer for everyday hydration.",
    price: 49900,
    stock: 20,
    image_url: ""
  },
  {
    name: "Vitamin C Face Serum",
    description: "A lightweight serum for a brighter-looking complexion.",
    price: 69900,
    stock: 15,
    image_url: ""
  },
  {
    name: "Daily Sunscreen SPF 50",
    description: "Daily sun protection for your skincare routine.",
    price: 59900,
    stock: 30,
    image_url: ""
  },
  {
    name: "Aloe Vera Gel",
    description: "A refreshing gel for everyday skincare.",
    price: 24900,
    stock: 40,
    image_url: ""
  },
  {
    name: "Overnight Repair Cream",
    description: "A nourishing cream for your nighttime routine.",
    price: 79900,
    stock: 12,
    image_url: ""
  }
];

const insertProduct = db.prepare(`
  INSERT INTO products (name, description, price, stock, image_url)
  VALUES (@name, @description, @price, @stock, @image_url)
`);

const seedProducts = db.transaction(() => {
  for (const product of products) {
    const existing = db.prepare(
      "SELECT id FROM products WHERE name = ?"
    ).get(product.name);

    if (!existing) {
      insertProduct.run(product);
    }
  }
});

seedProducts();

console.log("Sample skincare products added successfully.");
console.log(
  db.prepare("SELECT id, name, price, stock FROM products").all()
);

db.close();
