import type { faqEs } from "./faq-es";

// Texts of the frequently asked questions page. The questions and answers
// live in the database (FR-137); only the fixed text of the page is here.
export const faqEn = {
  "faq.title": "FAQ: VolleyTip",
  "faq.description":
    "Answers to the most common questions about VolleyTip: tips, shop, camps and the app.",
  "faq.eyebrow": "Help",
  "faq.heading": "Frequently asked questions",
  "faq.empty.text":
    "There are no published questions yet. Check back soon, we are preparing them.",
  "faq.contact.text": "Have another question? ",
  "faq.contact.link": "Write to us",
} as const satisfies Record<keyof typeof faqEs, string>;
