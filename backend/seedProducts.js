
import pool, { initializeDatabase } from "./config/database.js";

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

async function seedProducts() {
  await initializeDatabase();

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const product of products) {
      await client.query(
        `INSERT INTO products (name, description, price, stock, image_url)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING`,
        [
          product.name,
          product.description,
          product.price,
          product.stock,
          product.image_url
        ]
      );
    }

    await client.query("COMMIT");

    const result = await client.query(
      "SELECT id, name, price, stock FROM products ORDER BY id"
    );

    console.log("Sample skincare products added successfully.");
    console.table(result.rows);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seedProducts().catch((error) => {
  console.error("Product seeding failed:", error.message);
  process.exitCode = 1;
});
