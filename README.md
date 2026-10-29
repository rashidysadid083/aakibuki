# আঁকিবুঁকি | Aankibuki (Vite প্রজেক্ট)

## চালানোর নিয়ম
প্রথমবার একবার ইন্টারনেট লাগবে (npm থেকে প্যাকেজ নামাতে)। এরপর সবকিছু অফলাইনে চলে।

```
npm install
npm run dev        # ডেভ সার্ভার, ব্রাউজারে দেখা লিংকটা খোলো
npm run build      # dist/ ফোল্ডারে চূড়ান্ত বিল্ড
npm run preview    # dist/ ফোল্ডার লোকাল সার্ভারে চালিয়ে দেখো
```

- three.js npm থেকে আসে, সংস্করণ `0.128.0` (আগের CDN-এর r128-এর হুবহু একই)। সংস্করণ বদলালো না, কারণ নতুন three.js-এ রঙ ও আলো অন্যরকম দেখায়।
- `dist/` ফোল্ডার `file://` দিয়ে সরাসরি খুললে ব্রাউজার ES মডিউল আটকে দেয়। `npm run preview` বা যেকোনো স্ট্যাটিক সার্ভার (হোস্টিং সহ) ব্যবহার করো।
- আগের HTML যেসব ফাইল ডাকত (`manifest.webmanifest`, `icon-192.png`, `sw.js`), সেগুলো আপলোড করা ফাইলে ছিল না। তোমার কাছে থাকা আসল ফাইলগুলো `public/` ফোল্ডারে রাখো, বিল্ডে নিজে থেকে `dist/`-এ চলে যাবে।
- কোনো ওয়েব ফন্ট ব্যবহার হয়নি (আগের কোডেও শুধু `sans-serif` আর `monospace`), তাই আলাদা ফন্ট ফাইল নেই।

## ফাইল ভাগ
- `main.js`: সব `init…()` ডাকে, তারপর লুপ চালু করে
- `state.js`: ভাগ করা অবস্থা (`GS`), `keys`, `fwd`, `parked`
- `config.js`, `rng.js`, `noise.js`: ধ্রুবক, র‍্যান্ডম, সিমপ্লেক্স নয়েজ
- `core.js`, `textures.js`: রেন্ডারার/দৃশ্য/আলো/টুন শেডিং, canvas টেক্সচার
- `terrain.js`, `props.js`, `roads.js`, `chunks.js`: উচ্চতা ও রাস্তার জাল, গাছ-বাড়ি, রাস্তার মেশ, chunk স্ট্রিমিং ও ধাক্কা
- `vehicles.js`, `people.js`, `actors.js`: গাড়ি, মানুষ, চলন্ত এনপিসি
- `pm.js`, `modes.js`, `transit.js`: মোড বদল, মোড-বোতাম, গাড়িতে ওঠা-নামা
- `drive.js`, `walk.js`, `fly.js`, `flightphys.js`, `paperplane.js`, `birds.js`: চলা, হাঁটা, ওড়া
- `input.js`, `settings.js`, `quality.js`, `audio.js`, `daynight.js`, `overlay.js`, `loop.js`
