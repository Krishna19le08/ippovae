// Demo accounts for trying the shop without signing up. Opt-in: nothing shows unless
// NEXT_PUBLIC_DEMO_ACCOUNTS=1 is set. There is no backend, so these are NOT real credentials and protect nothing;
// anyone who can read the site's JavaScript can read them. Never reuse a real password here.
export const DEMO_ENABLED = process.env.NEXT_PUBLIC_DEMO_ACCOUNTS === "1";

export const DEMO_PASSWORD = "Demo1234";

// Saved for each demo account on first sign-in so checkout works without typing an address. Made-up details
// (the mobile number and street are placeholders); the pincode and city are real, matching the Coimbatore dispatch point.
export const DEMO_PHONE = "9876543210";
export const DEMO_ADDRESS = {
  id: "demo-address",
  phone: DEMO_PHONE,
  pincode: "641001",
  city: "Coimbatore",
  state: "Tamil Nadu",
  flat: "Demo Workshop, Unit 12",
  area: "Demo Industrial Estate, Gandhipuram",
  landmark: "",
  type: "work",
  isDefault: true,
};

export const DEMO_ACCOUNTS = [
  { role: "Shopper", name: "Demo Shopper", email: "demo-user@know.test" },
];
