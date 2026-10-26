import { withBase } from "@/lib/asset";

export const SITE = "https://www.oknow.co.in";
export const SHOP = `${SITE}/copy-of-bearings`;
export const HUB = `${SITE}/k-now-hub`;
// Digits only, with country code (e.g. "919876543210"). Until set, WhatsApp opens and lets the sender pick who to message.
export const WHATSAPP = "";
export const whatsappHref = (text = "") => `https://wa.me/${WHATSAPP}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
export const product = (slug) => `${SITE}/product-page/${slug}`;

export const socials = [
  ["LinkedIn", "https://www.linkedin.com/company/knowbydk/"],
  ["Facebook", "http://www.facebook.com/kradinteaprivatelimited"],
  ["Instagram", "http://instagram.com/knowbydk"],
];

// Prices in INR, taken from the ippovae shop (apparel, firewood and fertiliser listings left out).
const RAW_PRODUCTS = [
 {
  "name": "HE212 Bearing Sleeve",
  "price": 450,
  "cat": "Sleeves",
  "slug": "he212-bearing-sleeve",
  "img": "/products/9b33e1e1e0.jpg"
 },
 {
  "name": "22212 Bearing",
  "price": 3800,
  "cat": "Roller Bearings",
  "slug": "22212-bearing",
  "img": "/products/dad9a0aff9.jpg"
 },
 {
  "name": "6205 Bearing",
  "price": 220,
  "cat": "Ball Bearings",
  "slug": "6205-bearing",
  "img": "/products/ffbd2f2397.jpg"
 },
 {
  "name": "6306 Bearing",
  "price": 400,
  "cat": "Ball Bearings",
  "slug": "6306-bearing",
  "img": "/products/65b441dbf1.jpg"
 },
 {
  "name": "21313 Bearing",
  "price": 4800,
  "cat": "Roller Bearings",
  "slug": "21313-bearing",
  "img": "/products/940d0cea6f.jpg"
 },
 {
  "name": "51316 Thrust Bearing",
  "price": 3600,
  "cat": "Thrust Bearings",
  "slug": "51316-thrust-bearing",
  "img": "/products/7974965927.jpg"
 },
 {
  "name": "B40 Belt Fenner",
  "price": 194,
  "cat": "Belts",
  "slug": "b40-belt-fenner",
  "img": "/products/3a100f50f9.jpg"
 },
 {
  "name": "C127 Belt Fenner",
  "price": 1175,
  "cat": "Belts",
  "slug": "c127-belt-fenner",
  "img": "/products/3a100f50f9.jpg",
  "brand": "Royal Bearings"
 },
 {
  "name": "C76 Belt Fenner",
  "price": 548,
  "cat": "Belts",
  "slug": "c76-belt-fenner",
  "img": "/products/3a100f50f9.jpg",
  "brand": "Royal Bearings"
 },
 {
  "name": "Belt B49 Fenner",
  "price": 251,
  "cat": "Belts",
  "slug": "belt-b49-fenner",
  "img": "/products/3a100f50f9.jpg"
 },
 {
  "name": "Hot Rolled Sheet HSN: 72083840 (per kg)",
  "price": 62,
  "cat": "Sheet",
  "slug": "hot-rolled-sheet-hsn-72083840",
  "img": "/products/3d85f9fd05.jpg"
 },
 {
  "name": "6313 Bearing",
  "price": 1937,
  "cat": "Ball Bearings",
  "slug": "6313-bearing",
  "img": "/products/dec681c9be.jpg"
 },
 {
  "name": "UCHA 206 Bearing",
  "price": 650,
  "cat": "Mounted Bearings",
  "slug": "ucha-206-bearing",
  "img": "/products/5416853d77.jpg"
 },
 {
  "name": "Belt C101 Fenner",
  "price": 890,
  "cat": "Belts",
  "slug": "belt-c101-fenner",
  "img": "/products/3a100f50f9.jpg"
 },
 {
  "name": "UCP 207 Bearing",
  "price": 550,
  "cat": "Mounted Bearings",
  "slug": "ucp-207-bearing",
  "img": "/products/43955fa49d.jpg"
 },
 {
  "name": "1309EKT Bearing",
  "price": 1000,
  "cat": "Ball Bearings",
  "slug": "1309ekt-bearing",
  "img": "/products/344a5188a1.jpg"
 },
 {
  "name": "6310ZZ Bearing",
  "price": 1050,
  "cat": "Ball Bearings",
  "slug": "6310zz-bearing",
  "img": "/products/425acfb999.jpg"
 },
 {
  "name": "6410 Bearing",
  "price": 2400,
  "cat": "Ball Bearings",
  "slug": "6410-bearing",
  "img": "/products/414e4f3794.jpg",
  "tag": "New"
 },
 {
  "name": "Thrust Bearing 51105",
  "price": 400,
  "cat": "Thrust Bearings",
  "slug": "thrust-bearing-51105",
  "img": "/products/d611500767.jpg",
  "brand": "Mithra Engineering"
 },
 {
  "name": "Bearing 22311",
  "price": 4300,
  "cat": "Roller Bearings",
  "slug": "bearing-22311",
  "img": "/products/9f64f8fe08.jpg"
 },
 {
  "name": "6315 Bearing",
  "price": 2960,
  "cat": "Ball Bearings",
  "slug": "6315-bearing",
  "img": "/products/d704244297.jpg"
 },
 {
  "name": "UCF 207 Bearing",
  "price": 900,
  "cat": "Mounted Bearings",
  "slug": "ucf-207-bearing",
  "img": "/products/9686535fb1.jpg"
 },
 {
  "name": "UCP 205 Bearing",
  "price": 340,
  "cat": "Mounted Bearings",
  "slug": "ucp-205-bearing",
  "img": "/products/414cf8e2c3.jpg"
 },
 {
  "name": "UCT 209 Bearing",
  "price": 750,
  "cat": "Mounted Bearings",
  "slug": "uct-209-bearing",
  "img": "/products/0453c92cf8.jpg"
 },
 {
  "name": "N312 Bearing",
  "price": 3200,
  "cat": "Roller Bearings",
  "slug": "n312-bearing",
  "img": "/products/0292c4e098.jpg"
 },
 {
  "name": "6312 Bearing",
  "price": 1870,
  "cat": "Ball Bearings",
  "slug": "6312-bearing",
  "img": "/products/d704244297.jpg"
 },
 {
  "name": "B73 Belt Fenner",
  "price": 385,
  "cat": "Belts",
  "slug": "b73-belt-fenner",
  "img": "/products/3a100f50f9.jpg"
 },
 {
  "name": "B45 Belt Fenner",
  "price": 250,
  "cat": "Belts",
  "slug": "b45-belt-fenner",
  "img": "/products/3a100f50f9.jpg"
 },
 {
  "name": "B68 Belt Fenner",
  "price": 359.7,
  "cat": "Belts",
  "slug": "b68-belt-fenner",
  "img": "/products/3a100f50f9.jpg"
 },
 {
  "name": "A75 Belt Fenner",
  "price": 302.1,
  "cat": "Belts",
  "slug": "a75-belt-fenner",
  "img": "/products/3a100f50f9.jpg"
 },
 {
  "name": "A74 Belt Fenner",
  "price": 389.4,
  "cat": "Belts",
  "slug": "a74-belt-fenner",
  "img": "/products/3a100f50f9.jpg"
 },
 {
  "name": "C105 Belt Fenner",
  "price": 928,
  "cat": "Belts",
  "slug": "c105-belt-fenner",
  "img": "/products/3a100f50f9.jpg"
 },
 {
  "name": "A70 Belt Fenner",
  "price": 285,
  "cat": "Belts",
  "slug": "a70-belt-fenner",
  "img": "/products/3a100f50f9.jpg"
 },
 {
  "name": "B70 Belt Fenner",
  "price": 367,
  "cat": "Belts",
  "slug": "b70-belt-fenner",
  "img": "/products/3a100f50f9.jpg"
 },
 {
  "name": "B57 Belt Fenner",
  "price": 294.69,
  "cat": "Belts",
  "slug": "b57-belt-fenner",
  "img": "/products/3a100f50f9.jpg"
 },
 {
  "name": "B83 Belt Fenner",
  "price": 438,
  "cat": "Belts",
  "slug": "b83-belt-fenner",
  "img": "/products/3a100f50f9.jpg"
 },
 {
  "name": "B76 Belt",
  "price": 397.7,
  "cat": "Belts",
  "slug": "b76-belt",
  "img": "/products/3a100f50f9.jpg"
 },
 {
  "name": "B75 Belt",
  "price": 405,
  "cat": "Belts",
  "slug": "b75-belt",
  "img": "/products/3a100f50f9.jpg"
 },
 {
  "name": "B78 Belt",
  "price": 399.85,
  "cat": "Belts",
  "slug": "b78-belt",
  "img": "/products/3a100f50f9.jpg"
 },
 {
  "name": "B102 Belt",
  "price": 629.7,
  "cat": "Belts",
  "slug": "b102-belt",
  "img": "/products/3a100f50f9.jpg"
 },
 {
  "name": "B85 Belt",
  "price": 487,
  "cat": "Belts",
  "slug": "b85-belt",
  "img": "/products/3a100f50f9.jpg"
 },
 {
  "name": "B68 Belt",
  "price": 359.7,
  "cat": "Belts",
  "slug": "b68-belt",
  "img": "/products/3a100f50f9.jpg"
 },
 {
  "name": "B62 Belt",
  "price": 311.79,
  "cat": "Belts",
  "slug": "b62-belt",
  "img": "/products/3a100f50f9.jpg"
 },
 {
  "name": "B46 Belt",
  "price": 241.45,
  "cat": "Belts",
  "slug": "b46-belt",
  "img": "/products/3a100f50f9.jpg"
 },
 {
  "name": "B65 Belt",
  "price": 332.5,
  "cat": "Belts",
  "slug": "b65-belt",
  "img": "/products/3a100f50f9.jpg"
 },
 {
  "name": "C88 Belt",
  "price": 707.85,
  "cat": "Belts",
  "slug": "c88-belt",
  "img": "/products/3a100f50f9.jpg"
 },
 {
  "name": "C150 Belt",
  "price": 1362.95,
  "cat": "Belts",
  "slug": "c150-belt",
  "img": "/products/3a100f50f9.jpg"
 },
 {
  "name": "B52 Belt",
  "price": 264,
  "cat": "Belts",
  "slug": "b52-belt",
  "img": "/products/3a100f50f9.jpg"
 },
 {
  "name": "UCF 206 Bearing",
  "price": 380,
  "cat": "Mounted Bearings",
  "slug": "ucf-206-bearing",
  "img": "/products/a54ca9b149.jpg"
 },
 {
  "name": "UCT206 Bearing",
  "price": 510,
  "cat": "Mounted Bearings",
  "slug": "uct206",
  "img": "/products/a97d0155d2.jpg"
 },
 {
  "name": "Bearing 6310",
  "price": 1050,
  "cat": "Ball Bearings",
  "slug": "bearing-6310",
  "img": "/products/28d21d24ea.jpg"
 },
 {
  "name": "Bearing 6307",
  "price": 335,
  "cat": "Ball Bearings",
  "slug": "bearing-6305",
  "img": "/products/28d21d24ea.jpg"
 },
 {
  "name": "Bearing 6305",
  "price": 190,
  "cat": "Ball Bearings",
  "slug": "bearing-6307",
  "img": "/products/28d21d24ea.jpg"
 },
 {
  "name": "UC209 Bearing",
  "price": 1000,
  "cat": "Mounted Bearings",
  "slug": "uc209-bearing",
  "img": "/products/10e185bd43.jpg"
 },
 {
  "name": "Screws 10nos.",
  "price": 153,
  "cat": "Hardware & Machines",
  "slug": "screws-10nos",
  "img": "/products/5e31015517.jpg"
 },
 {
  "name": "N314 Bearing",
  "price": 4400,
  "cat": "Roller Bearings",
  "slug": "n314-bearing",
  "img": "/products/b98a2208ea.jpg"
 },
 {
  "name": "UCP 209 Bearing",
  "price": 650,
  "cat": "Mounted Bearings",
  "slug": "ucp-209-bearing",
  "img": "/products/465b0fdd9d.jpg"
 },
 {
  "name": "Bearing 6313 N",
  "price": 5400,
  "cat": "Ball Bearings",
  "slug": "bearing-6313-n",
  "img": "/products/dec681c9be.jpg"
 },
 {
  "name": "N 313 N Bearing",
  "price": 5400,
  "cat": "Roller Bearings",
  "slug": "n-313-n-bearing",
  "img": "/products/262e10c480.jpg"
 },
 {
  "name": "Nuts and Bolts 40pcs",
  "price": 1400,
  "cat": "Hardware & Machines",
  "slug": "nuts-and-bolts-12-pcs",
  "img": "/products/c50d6dcccc.jpg"
 },
 {
  "name": "UCP 208 Bearing",
  "price": 590,
  "cat": "Mounted Bearings",
  "slug": "ucp-208-bearing",
  "img": "/products/8bd68c97af.jpg"
 },
 {
  "name": "Bearing 6212",
  "price": 710,
  "cat": "Ball Bearings",
  "slug": "bearing-6212",
  "img": "/products/d704244297.jpg"
 },
 {
  "name": "C110 V Belt Fenner",
  "price": 967,
  "cat": "Belts",
  "slug": "c110-v-belt-fenner",
  "img": "/products/8b8d8d772b.jpg"
 },
 {
  "name": "C100 V Belt Fenner",
  "price": 848,
  "cat": "Belts",
  "slug": "c100-v-belt-fenner",
  "img": "/products/8e477a50aa.jpg"
 },
 {
  "name": "B58 Belt Fenner",
  "price": 312,
  "cat": "Belts",
  "slug": "b58-belt-fenner",
  "img": "/products/3a100f50f9.jpg"
 },
 {
  "name": "32307 Bearing",
  "price": 520,
  "cat": "Roller Bearings",
  "slug": "32307-bearing",
  "img": "/products/73a2f1ed7e.jpg"
 },
 {
  "name": "33111 Bearing",
  "price": 720,
  "cat": "Roller Bearings",
  "slug": "33111-bearing",
  "img": "/products/b5c25031ca.jpg"
 },
 {
  "name": "UT209 Bearing",
  "price": 710,
  "cat": "Mounted Bearings",
  "slug": "ut209",
  "img": "/products/cb7071292f.jpg"
 },
 {
  "name": "Bearing 6310 2 RS",
  "price": 1214,
  "cat": "Ball Bearings",
  "slug": "bearing-6310-2-rs",
  "img": "/products/425acfb999.jpg"
 },
 {
  "name": "Bearing 6309",
  "price": 900,
  "cat": "Ball Bearings",
  "slug": "bearing-6309",
  "img": "/products/4b3c8cdf95.jpg"
 },
 {
  "name": "N 313 Bearing Heavy Duty Industrial",
  "price": 3600,
  "cat": "Roller Bearings",
  "slug": "n-313-bearing-i-heavyduty-industrial",
  "img": "/products/e64ab0856e.jpg"
 },
 {
  "name": "Leaf Cutting Machine",
  "price": 20000,
  "cat": "Hardware & Machines",
  "slug": "leaf-cutting-machine",
  "img": "/products/7ea4e81aa8.jpg"
 },
 {
  "name": "Universal Cross Joint 1210",
  "price": 690,
  "cat": "Hardware & Machines",
  "slug": "universal-cross-joint-1210",
  "img": "/products/a003754b18.jpg"
 },
 {
  "name": "Belt B70 Fenner",
  "price": 401.4,
  "cat": "Belts",
  "slug": "belt-b70-fenner",
  "img": "/products/0fac8ed36e.jpg",
  "was": 669
 },
 {
  "name": "Belt B 48 Fenner",
  "price": 272.4,
  "cat": "Belts",
  "slug": "belt-b-48-fenner",
  "img": "/products/a63a2a0300.jpg",
  "was": 454
 },
 {
  "name": "Belt B47 Fenner",
  "price": 267.0,
  "cat": "Belts",
  "slug": "belt-b47-fenner",
  "img": "/products/7f1ad9d3fb.jpg",
  "was": 445
 },
 {
  "name": "Belt B74 Fenner",
  "price": 421.8,
  "cat": "Belts",
  "slug": "belt-b74-fenner",
  "img": "/products/79df34bcb5.jpg",
  "was": 703
 },
 {
  "name": "Belt B46 Fenner",
  "price": 263.4,
  "cat": "Belts",
  "slug": "belt-b46-fenner",
  "img": "/products/d75c108999.jpg",
  "was": 439
 },
 {
  "name": "Belt C93 Fenner",
  "price": 836.55,
  "cat": "Belts",
  "slug": "belt-c93-fenner",
  "img": "/products/f2014cdb7b.jpg",
  "was": 1521,
  "tag": "New"
 },
 {
  "name": "Belt B68 Fenner",
  "price": 392.4,
  "cat": "Belts",
  "slug": "belt-b68-fenner",
  "img": "/products/cdb92871fe.jpg",
  "was": 654
 },
 {
  "name": "Bearings 6209",
  "price": 400,
  "cat": "Ball Bearings",
  "slug": "bearings-6209",
  "img": "/products/7427f744ce.jpg"
 },
 {
  "name": "Bearing NU 4921",
  "price": 700,
  "cat": "Roller Bearings",
  "slug": "bearing-nu-4921",
  "img": "/products/ac5b7fe347.jpg"
 },
 {
  "name": "Oil Seal 48x72x8",
  "price": 65,
  "cat": "Hardware & Machines",
  "slug": "oil-seal-size-48x72x8",
  "img": "/products/428df94526.jpg"
 }
];

export const products = RAW_PRODUCTS.map((p) => ({ ...p, img: withBase(p.img) }));

export const FEATURED = ["6205-bearing", "22212-bearing", "51316-thrust-bearing", "c127-belt-fenner", "he212-bearing-sleeve", "ucp-207-bearing", "6410-bearing"];

const RAW_CATEGORIES = [
 {
  "name": "Ball Bearings",
  "img": "/products/ffbd2f2397.jpg",
  "count": 16
 },
 {
  "name": "Roller Bearings",
  "img": "/products/dad9a0aff9.jpg",
  "count": 10
 },
 {
  "name": "Mounted Bearings",
  "img": "/products/5416853d77.jpg",
  "count": 11
 },
 {
  "name": "Thrust Bearings",
  "img": "/products/7974965927.jpg",
  "count": 2
 },
 {
  "name": "Belts",
  "img": "/products/3a100f50f9.jpg",
  "count": 37
 },
 {
  "name": "Sleeves",
  "img": "/products/9b33e1e1e0.jpg",
  "count": 1
 },
 {
  "name": "Hardware & Machines",
  "img": "/products/5e31015517.jpg",
  "count": 5
 },
 {
  "name": "Sheet",
  "img": "/products/3d85f9fd05.jpg",
  "count": 1
 }
];

export const categories = RAW_CATEGORIES.map((c) => (c.img ? { ...c, img: withBase(c.img) } : c));

// whole rupees print plain (₹450); anything with paise always shows two decimals (₹359.70)
export const inr = (n) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;
