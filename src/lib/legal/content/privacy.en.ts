import type { LegalText } from "../legal-text-types";

export const privacyEn: LegalText = {
  title: "Privacy policy",
  description:
    "What data VolleyTip asks for, what we use it for and how you can ask us to delete it.",
  blocks: [
    {
      type: "paragraph",
      text: "This policy explains how VolleyTip handles your personal data, in line with Colombian Law 1581 of 2012.",
    },
    { type: "heading", text: "Data controller" },
    {
      type: "paragraph",
      text: "VolleyTip, in Colombia. Contact email: team@volleytip.com.",
    },
    { type: "heading", text: "What data we ask for" },
    {
      type: "list",
      items: [
        "Contact form: your name, your email and your message.",
        "Waitlist: your email.",
        "Purchases: the delivery and billing details the order needs.",
        "Camp sign-up: the details of the participant and their contact.",
      ],
    },
    { type: "heading", text: "What we use it for" },
    {
      type: "list",
      items: [
        "To answer your messages.",
        "To let you know about news you asked for.",
        "To deliver your purchases and manage your sign-ups.",
      ],
    },
    { type: "heading", text: "Who we share it with" },
    {
      type: "paragraph",
      text: "Wompi processes the payment. We use hosting and email providers that handle the data only to provide their service to us.",
    },
    { type: "heading", text: "Your rights" },
    {
      type: "paragraph",
      text: "You can access, update and correct your data, and ask us to delete it, by writing to team@volleytip.com. Retention periods will be published in the final text.",
    },
  ],
};
