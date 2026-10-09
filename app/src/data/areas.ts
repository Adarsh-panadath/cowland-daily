/** Localities on the landing-page area checker and in sign-up. */
export interface Area {
  id: string;
  name: string;
  route: string | null; // null: not served yet, collect a waitlist
}

export const areas: Area[] = [
  { id: "samarth", name: "Samarth Nagar, Nirala Bazar", route: "r4" },
  { id: "cidco", name: "CIDCO N-1 to N-6", route: "r2" },
  { id: "station", name: "Station Road, Kranti Chowk", route: "r1" },
  { id: "ulka", name: "Ulkanagari, Beed Bypass", route: "r3" },
  { id: "jalna", name: "Jalna Road, Mukundwadi", route: "r5" },
  { id: "satara", name: "Satara Parisar", route: null },
  { id: "harsul", name: "Harsul", route: null },
  { id: "padegaon", name: "Padegaon", route: null },
  { id: "paithan", name: "Paithan Road", route: null },
];

export const areaById = Object.fromEntries(areas.map((a) => [a.id, a])) as Record<string, Area>;

/**
 * Illustrative launch threshold: households on the waitlist before a new route is worth running.
 * A real number would come from route economics (van cost per morning ÷ margin per household).
 */
export const WAITLIST_THRESHOLD = 60;
