import type { LegalText } from "../legal-text-types";

export const termsEn: LegalText = {
  title: "Terms and conditions",
  description:
    "The rules for using volleytip.com, buying in the shop and signing up for VolleyTip camps.",
  blocks: [
    {
      type: "paragraph",
      text: "These terms govern the use of volleytip.com, a site run by VolleyTip in Colombia. By using the site, you accept these rules.",
    },
    { type: "heading", text: "Who VolleyTip is" },
    {
      type: "paragraph",
      text: "VolleyTip is responsible for the site. You can write to us at team@volleytip.com.",
    },
    { type: "heading", text: "What the site offers" },
    {
      type: "list",
      items: [
        "Volleyball tips and VBall Tour content.",
        "A shop with physical and digital products.",
        "Sign-up and check-in for Volleyball Camps.",
        "Contact forms and waitlists.",
      ],
    },
    { type: "heading", text: "Purchases and sign-ups" },
    {
      type: "paragraph",
      text: "Payments are made with Wompi. Prices are shown in Colombian pesos and you are charged in pesos. Shipping, exchange, return and refund conditions will be published on their own pages.",
    },
    { type: "heading", text: "Proper use" },
    {
      type: "paragraph",
      text: "You may not use the site to damage it, to send automated messages or to impersonate another person.",
    },
    { type: "heading", text: "Content" },
    {
      type: "paragraph",
      text: "The videos, texts and images on the site belong to VolleyTip or to those who allowed us to use them. You may not copy or resell them without permission.",
    },
    { type: "heading", text: "Changes and governing law" },
    {
      type: "paragraph",
      text: "We may update these terms, and each version carries its number and date. They are governed by the laws of Colombia.",
    },
  ],
};
