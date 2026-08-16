/**
 * Canonical brewer key — for POOLING the user's own measured brews.
 *
 * The same physical brewer reaches the corpus under several labels: the flow's
 * method picker writes "Orea Classic", a chat-authored recipe writes "Orea V4
 * Classic", and since the Drip-Assist work either can carry "+ Drip Assist".
 * Anything that learns from the user's history by grouping on the raw string
 * therefore splits one brewer across several buckets — and the timing
 * calibration needs >= 2 samples in a bucket before it will trust them, so
 * fragmentation silently switches the learning off. That only bites once the
 * corpus is large enough for the buckets to matter, which is where we now are.
 *
 * The disc IS part of the key: it adds flow resistance, so an Orea brewed with
 * the Drip Assist is not the same flow regime as an Orea without it. Pooling
 * those would average away the very difference the calibration exists to catch.
 *
 * An unrecognised brewer falls back to its own normalised string rather than a
 * shared "other" bucket — two unknown brewers must not be averaged together.
 */

const FAMILIES: Array<[RegExp, string]> = [
  [/aeropress/, "aeropress"],
  [/moccamaster|technivorm/, "moccamaster"],
  [/chemex/, "chemex"],
  [/clever/, "clever"],
  [/kalita/, "kalita"],
  [/origami/, "origami"],
  [/orea/, "orea"],
  // v60 last: "Origami (cone, V60 filter)" is an Origami, not a V60.
  [/v60|hario/, "v60"],
];

const DRIP_ASSIST = /\bdrip[\s-]?assist\b/;

export function brewMethodKey(method?: string): string {
  const raw = (method ?? "").toLowerCase().trim();
  if (!raw) return "unknown";

  const disc = DRIP_ASSIST.test(raw);
  const withoutDisc = raw.replace(DRIP_ASSIST, " ");
  const suffix = disc ? "+drip-assist" : "";

  for (const [re, family] of FAMILIES) {
    if (re.test(withoutDisc)) return family + suffix;
  }

  // Unknown brewer: keep it distinct, just normalised enough that spacing and
  // punctuation differences don't create two buckets for one label.
  const normalised = withoutDisc.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return (normalised || "unknown") + suffix;
}
