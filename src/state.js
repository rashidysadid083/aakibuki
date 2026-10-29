import * as THREE from 'three';

// সব মডিউলের ভাগ করা পরিবর্তনশীল অবস্থা (মূল কোডের গ্লোবাল let-গুলো)
export const GS = {
  focus: null,      // ক্যামেরা, chunk আর শব্দ যার পিছু নেয়
  veh: null,        // এখন যে গাড়ি চালাচ্ছ
  pmode: 'drive',
  speed: 0, heading: 0, wantExit: false,
  jx: 0, jy: 0,
  hHead: 0, hSpeed: 0, hPh: 0,
  airH: 0, boostHeld: false, fobj: null,
  braking: false, actorLimit: 11,
  btnMode: false, btnGas: false, btnL: false, btnR: false,
  actTxt: ''
};
export const keys = {};
export const fwd = new THREE.Vector3();
export const parked = []; // এখন যে গাড়ি কেউ চালাচ্ছে না (পথের এনপিসি নয়)
