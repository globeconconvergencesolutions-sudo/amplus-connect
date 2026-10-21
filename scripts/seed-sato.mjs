// Uploads Amplus Facebook Sato photos and upserts the three shop SKUs.
// Usage: node --env-file=.env scripts/seed-sato.mjs

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const assets = join(root, "scripts/assets/sato");

const url = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "").replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!url || !key) {
  console.error("Need VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
};

async function upload(filename) {
  const body = readFileSync(join(assets, filename));
  const path = `products/sato/${filename}`;
  const res = await fetch(`${url}/storage/v1/object/media/${path}`, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "image/jpeg",
      "x-upsert": "true",
      "cache-control": "3600",
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload ${filename} failed (${res.status}): ${text}`);
  }
  return `${url}/storage/v1/object/public/media/${path}`;
}

const files = [
  "sato-pan.jpg",
  "sato-flex.jpg",
  "sato-stool.jpg",
  "sato-stool-boxed.jpg",
  "sato-range.jpg",
  "sato-pan-price.jpg",
  "sato-flex-price.jpg",
  "sato-stool-price.jpg",
];

const publicUrl = {};
for (const file of files) {
  publicUrl[file] = await upload(file);
  console.log("uploaded", file);
}

const categoryRes = await fetch(`${url}/rest/v1/categories?on_conflict=slug`, {
  method: "POST",
  headers: {
    ...headers,
    "Content-Type": "application/json",
    Prefer: "resolution=merge-duplicates,return=representation",
  },
  body: JSON.stringify({
    name: "Sanitation",
    slug: "sanitation",
    description: "SATO pit-latrine toilets — pan, flex and stool",
    sort_order: 0,
  }),
});
if (!categoryRes.ok) {
  throw new Error(`Category upsert failed (${categoryRes.status}): ${await categoryRes.text()}`);
}
const [category] = await categoryRes.json();
console.log("category", category.slug, category.id);

const yard = "Mombasa Road, Nairobi";
const orderLine = (process.env.VITE_COMPANY_PHONE || "").trim();
const orderEmail = (process.env.VITE_COMPANY_EMAIL || "").trim();
const orderSentence = orderLine
  ? `Orders go through ${orderLine}${orderEmail ? ` or ${orderEmail}` : ""}. Pickup and delivery are arranged from Mombasa Road.`
  : "Pickup and delivery are arranged from Mombasa Road. The shop shows the current yard phone and email.";

const products = [
  {
    name: "SATO Pan",
    slug: "sato-pan",
    brand: "Sato",
    price_kes: 690,
    stock: 0,
    unit: "piece",
    is_featured: true,
    is_active: true,
    category_id: category.id,
    image_url: publicUrl["sato-pan.jpg"],
    gallery: [
      { url: publicUrl["sato-range.jpg"], alt: "Amplus SATO toilets range" },
      { url: publicUrl["sato-pan-price.jpg"], alt: "SATO Pan price card, KSh 690" },
    ],
    short_description: "Compact squat pan with a self-closing trap door. KSh 690 from Mombasa Road.",
    description: [
      "The SATO Pan is the compact squat toilet Amplus sells for pit latrines, either in a new slab or dropped into an existing one. A counterweighted door seals the pit when it is not in use, which cuts smell and keeps flies out. A flush uses under a litre of water.",
      `Amplus priced it at KSh 690 on 19 August. ${orderSentence}`,
    ].join("\n\n"),
    specifications: {
      Form: "Squat pan",
      Material: "Polypropylene",
      Colour: "Blue",
      Flush: "Under 1 litre",
      Seal: "Self-closing trap door",
      "Published size": "464 × 248 × 225 mm",
      "Order line": orderLine || "See yard line",
      ...(orderEmail ? { Email: orderEmail } : {}),
      Yard: yard,
    },
    seo_title: "SATO Pan | KSh 690 | Amplus",
    seo_description:
      "SATO Pan squat toilet with a self-closing trap door. KSh 690. Order from Amplus on Mombasa Road.",
  },
  {
    name: "SATO Flex",
    slug: "sato-flex",
    brand: "Sato",
    price_kes: 1070,
    stock: 0,
    unit: "piece",
    is_featured: true,
    is_active: true,
    category_id: category.id,
    image_url: publicUrl["sato-flex.jpg"],
    gallery: [
      { url: publicUrl["sato-range.jpg"], alt: "Amplus SATO toilets range" },
      { url: publicUrl["sato-flex-price.jpg"], alt: "SATO Flex price card, KSh 1,070" },
    ],
    short_description: "Wide retrofit pan with footrests. KSh 1,070.",
    description: [
      "The SATO Flex is the wider pan, with moulded footrests, made to cover a traditional pit that only has a small opening. It uses the same trap-door seal and the same low water use as the rest of the range.",
      `Amplus's 19 August post prices it at KSh 1,070 — “Flex your way to better comfort.” ${orderSentence}`,
    ].join("\n\n"),
    specifications: {
      Form: "Flex-install squat pan",
      Material: "Polypropylene",
      Colour: "Blue",
      Footrests: "Integrated",
      Flush: "About 500 ml",
      "Published size": "540 × 440 × 217 mm",
      "Order line": orderLine || "See yard line",
      "Also call": orderLine || "See yard line",
      ...(orderEmail ? { Email: orderEmail } : {}),
      Yard: yard,
    },
    seo_title: "SATO Flex | KSh 1,070 | Amplus",
    seo_description:
      "SATO Flex retrofit toilet pan with footrests. KSh 1,070. Order from Amplus on Mombasa Road.",
  },
  {
    name: "SATO Stool",
    slug: "sato-stool",
    brand: "Sato",
    price_kes: 1750,
    stock: 0,
    unit: "piece",
    is_featured: true,
    is_active: true,
    category_id: category.id,
    image_url: publicUrl["sato-stool.jpg"],
    gallery: [
      { url: publicUrl["sato-stool-boxed.jpg"], alt: "SATO Stool with pull cable, in front of SATO cartons" },
      { url: publicUrl["sato-range.jpg"], alt: "Amplus SATO toilets range" },
      { url: publicUrl["sato-stool-price.jpg"], alt: "SATO Stool price card, KSh 1,750" },
    ],
    short_description: "Sit-down stool for children, elders and anyone who should not squat. KSh 1,750.",
    description: [
      "The SATO Stool is the sit-down version of the same trap-door toilet. It is the one to choose for children, pregnant users, elders, and anyone who should not squat. A pull cable opens the door when there is no water to flush with.",
      `Amplus's 19 August post: “Sato stool built to give reliable support every day. KSh 1,750.” An earlier photo says “Sit in comfort. Built to last.” ${orderSentence}`,
    ].join("\n\n"),
    specifications: {
      Form: "Sit-down stool",
      Material: "Polypropylene",
      Colour: "Blue",
      Flush: "About 500 ml",
      Extra: "Pull cable for the trap door",
      "Published size": "548 × 460 × 305 mm",
      "Order line": orderLine || "See yard line",
      ...(orderEmail ? { Email: orderEmail } : {}),
      Yard: yard,
    },
    seo_title: "SATO Stool | KSh 1,750 | Amplus",
    seo_description:
      "SATO sit-down stool toilet with trap door and pull cable. KSh 1,750. Order from Amplus on Mombasa Road.",
  },
];

const productRes = await fetch(`${url}/rest/v1/products?on_conflict=slug`, {
  method: "POST",
  headers: {
    ...headers,
    "Content-Type": "application/json",
    Prefer: "resolution=merge-duplicates,return=representation",
  },
  body: JSON.stringify(products),
});
if (!productRes.ok) {
  throw new Error(`Product upsert failed (${productRes.status}): ${await productRes.text()}`);
}
const saved = await productRes.json();
for (const row of saved) {
  console.log("saved", row.slug, row.price_kes, row.image_url ? "with image" : "no image");
}
