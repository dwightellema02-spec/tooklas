// Which Grade 7 topic does a piece of text talk about? Used to notice when the student asks about something
// other than the lesson they have open, so the tutor can ask instead of guessing.

export interface TopicDef {
  id: string;
  /** Short name in English and Filipino for messages. */
  en: string;
  fil: string;
  pattern: RegExp;
}

export const TOPICS: TopicDef[] = [
  {
    id: "polygons",
    en: "polygons and their angles",
    fil: "mga polygon at ang mga anggulo nito",
    pattern: /\b(polygons?|pentagons?|hexagons?|heptagons?|octagons?|nonagons?|decagons?|quadrilaterals?|triangles?|vertex|vertices|interior angles?|exterior angles?|convex|concave|regular polygon|irregular|anggulo|gilid)\b/i,
  },
  {
    id: "angle-pairs",
    en: "angle pairs",
    fil: "mga pares ng anggulo",
    pattern: /\b(complementary|supplementary|adjacent angles?|linear pair|vertical angles?)\b/i,
  },
  {
    id: "percent",
    en: "percentages and money problems",
    fil: "porsyento at mga problemang may pera",
    pattern: /(\bpercent(age)?s?\b|\bporsyento\b|\bporsiyento\b|\bdiscount\b|\bdiskwento\b|\bcommission\b|\bkomisyon\b|\bsales tax\b|\bvat\b|\binterest\b|\binteres\b|\bsavings?\b|\bipon\b|\bbudget\b|\bsale price\b)/i,
  },
  {
    id: "rates",
    en: "rates and speed",
    fil: "rate at bilis",
    pattern: /\b(unit rate|speed|bilis|distance|km\/h|kph|per hour|bawat oras|rate)\b/i,
  },
  {
    id: "rational",
    en: "fractions and decimals",
    fil: "mga fraction at decimal",
    pattern: /\b(fractions?|decimals?|desimal|praksyon|rational numbers?)\b/i,
  },
  {
    id: "integers",
    en: "integers",
    fil: "mga integer",
    pattern: /\b(integers?|negative numbers?|negatibo|zero.?pairs?|absolute value|opposite numbers?)\b/i,
  },
];

export function topicsIn(text: string): TopicDef[] {
  if (!text) return [];
  return TOPICS.filter((t) => t.pattern.test(text));
}

/** The topics a lesson is about, from its title, objectives and skill (not its whole body). */
export function lessonTopics(parts: Array<string | undefined | null>): TopicDef[] {
  return topicsIn(parts.filter(Boolean).join(" . "));
}

export interface TopicConflict {
  mentioned: TopicDef;
  lessonTopic: TopicDef | null;
}

/**
 * The student's message is about a topic the open lesson is not about. Only reported when the lesson's topic
 * is known and the message clearly names a different one.
 */
export function detectTopicConflict(query: string | undefined, lessonHeader: Array<string | undefined | null>): TopicConflict | null {
  const q = (query || "").trim();
  if (q.split(/\s+/).length < 3) return null;
  const inLesson = lessonTopics(lessonHeader);
  if (inLesson.length === 0) return null;
  const mentioned = topicsIn(q);
  if (mentioned.length === 0) return null;
  if (mentioned.some((m) => inLesson.some((l) => l.id === m.id))) return null;
  // polygons and angle pairs belong together
  const together = (a: string, b: string) => (a === "polygons" && b === "angle-pairs") || (a === "angle-pairs" && b === "polygons");
  if (mentioned.some((m) => inLesson.some((l) => together(m.id, l.id)))) return null;
  return { mentioned: mentioned[0], lessonTopic: inLesson[0] };
}
