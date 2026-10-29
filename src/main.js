import { GS } from './state.js';
import { initCore } from './core.js';
import { initNoise } from './noise.js';
import { initProps } from './props.js';
import { initRoads } from './roads.js';
import { roadCoord } from './terrain.js';
import { initWorld, prebuildChunks } from './chunks.js';
import { initVehicles } from './vehicles.js';
import { initInput, initButtons } from './input.js';
import { initDayNight } from './daynight.js';
import { initActors } from './actors.js';
import { initHero } from './people.js';
import { initPM } from './pm.js';
import { initPaperPlane } from './paperplane.js';
import { initBirds } from './birds.js';
import { initModes } from './modes.js';
import { initPaperOverlays } from './overlay.js';
import { initQuality, applyTier, startTier } from './quality.js';
import { initSettings } from './settings.js';
import { initSound } from './audio.js';
import { initLoop, loop } from './loop.js';

// সব টপ-লেভেলের কাজ এখানে, মূল স্ক্রিপ্টের ক্রমেই
function init() {
  initCore();        // দৃশ্য, ক্যামেরা, আলো, টুন শেডিং
  initNoise();       // সিমপ্লেক্স নয়েজের তালিকা
  initProps();       // গাছ আর বাড়ির জিওমেট্রি
  initRoads();       // রাস্তার টেক্সচার, মেটেরিয়াল, বাতিস্তম্ভ
  initWorld();       // জমির মেটেরিয়াল
  initVehicles();    // গাড়ির মেটেরিয়াল + প্রথম গাড়ি
  initInput();       // কিবোর্ড + জয়স্টিক
  initLoop();        // FPS লেখা, সময়
  prebuildChunks();  // শুরুতে আশপাশের ৯টা chunk
  initDayNight();    // ঘড়ির বোতাম
  initActors();      // চলন্ত গাড়ি আর মানুষ
  initHero();        // হাঁটার চরিত্র
  initPM();          // মোড বদলের DOM
  initPaperPlane();  // কাগজের বিমান
  initBirds();       // পাখি নির্বাচন
  initModes();       // মোড-বোতাম, নামো/ঢোকো, বাতির বোতাম
  initPaperOverlays(); // কাগজের দানা + ছেঁড়া বর্ডার
  initQuality();     // মান
  initButtons();     // ব্রেক, ঘণ্টা, গ্যাস, বাঁ, ডান
  initSettings();    // সেটিং প্যানেল
  initSound();       // শব্দ
  try { if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) navigator.serviceWorker.register('sw.js').catch(() => {}); } catch (e) {}
  GS.heading = Math.atan2((roadCoord('z', 0, 1) - roadCoord('z', 0, -1)) / 2, 1); // শুরুতে রাস্তার দিকে মুখ
  applyTier(startTier);
  requestAnimationFrame(loop);
}

init();
