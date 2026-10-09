import type { RiderLang } from "../store/useStore";

/** Everything the rider sees, in plain words, in three languages. */
const t = {
  next: { en: "Next home", mr: "पुढचं घर", hi: "अगला घर" },
  done: { en: "done", mr: "झाली", hi: "हो गए" },
  left: { en: "left", mr: "बाकी", hi: "बाकी" },
  homes: { en: "homes", mr: "घरं", hi: "घर" },
  delivered: { en: "Delivered", mr: "दिलं", hi: "दे दिया" },
  problem: { en: "Problem", mr: "अडचण", hi: "समस्या" },
  call: { en: "Call", mr: "फोन", hi: "फ़ोन" },
  map: { en: "Map", mr: "नकाशा", hi: "नक्शा" },
  listen: { en: "Listen", mr: "ऐका", hi: "सुनें" },
  takeEmpty: { en: "Take empty bottles", mr: "रिकाम्या बाटल्या घ्या", hi: "खाली बोतलें लें" },
  whatProblem: { en: "What happened?", mr: "काय झालं?", hi: "क्या हुआ?" },
  doorLocked: { en: "Door locked", mr: "दार बंद", hi: "दरवाज़ा बंद" },
  itemBad: { en: "Item short or broken", mr: "माल कमी / फुटला", hi: "सामान कम / टूटा" },
  noWant: { en: "Customer said no", mr: "ग्राहक नको म्हणाले", hi: "ग्राहक ने मना किया" },
  noAddress: { en: "Can't find home", mr: "घर सापडलं नाही", hi: "घर नहीं मिला" },
  cancel: { en: "Cancel", mr: "रद्द", hi: "रद्द" },
  undo: { en: "Undo", mr: "परत", hi: "वापस" },
  saved: { en: "Saved", mr: "नोंद झाली", hi: "दर्ज हो गया" },
  allDone: { en: "All homes done!", mr: "सगळी घरं झाली!", hi: "सारे घर हो गए!" },
  goBack: { en: "Go back to the hub with the empty bottles.", mr: "रिकाम्या बाटल्या घेऊन हबवर परत या.", hi: "खाली बोतलें लेकर हब वापस आएं." },
  allHomes: { en: "All homes", mr: "सगळी घरं", hi: "सारे घर" },
  close: { en: "Close", mr: "बंद करा", hi: "बंद करें" },
  hubSays: { en: "Message from hub", mr: "हबचा संदेश", hi: "हब का संदेश" },
  ok: { en: "OK", mr: "ठीक आहे", hi: "ठीक है" },
  earnToday: { en: "Today's earning", mr: "आजची कमाई", hi: "आज की कमाई" },
  bottles: { en: "Empty bottles", mr: "रिकाम्या बाटल्या", hi: "खाली बोतलें" },
  onTime: { en: "On time", mr: "वेळेवर", hi: "समय पर" },
  perHome: { en: "per home", mr: "प्रति घर", hi: "प्रति घर" },
  perBottle: { en: "per bottle", mr: "प्रति बाटली", hi: "प्रति बोतल" },
  bonus: { en: "Bonus when all homes are done", mr: "सगळी घरं झाल्यावर बोनस", hi: "सारे घर होने पर बोनस" },
  flagged: { en: "Problem", mr: "अडचण", hi: "समस्या" },
  stop: { en: "Stop", mr: "थांबा", hi: "स्टॉप" },
  helpLine: { en: "Call hub", mr: "हबला फोन", hi: "हब को फ़ोन" },
} as const;

export type RiderKey = keyof typeof t;
export const tr = (k: RiderKey, l: RiderLang) => t[k][l];
export const speechLang: Record<RiderLang, string> = { en: "en-IN", mr: "mr-IN", hi: "hi-IN" };
