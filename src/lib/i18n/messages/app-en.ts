import type { appEs } from "./app-es";

// Textos de la página de la app y del formulario de lista de espera.
export const appEn: { readonly [Key in keyof typeof appEs]: string } = {
  "app.title": "VolleyTip app: your volleyball coach in your pocket",
  "app.description":
    "Drills, routines and tools for the court in a free app. Join the waitlist and we will let you know when it launches.",
  "app.badge": "Coming soon",
  "app.headingStart": "Your volleyball coach in your",
  "app.headingHighlight": "pocket",
  "app.intro":
    "Drills, routines and tools for the court. No likes, no streaks, no distractions: just training.",
  "app.stores.label": "Download the app",
  "app.stores.appStore.caption": "Download on the",
  "app.stores.appStore.name": "App Store",
  "app.stores.appStore.label": "Download on the App Store",
  "app.stores.playStore.caption": "Get it on",
  "app.stores.playStore.name": "Google Play",
  "app.stores.playStore.label": "Get it on Google Play",
  "app.phone.eyebrow": "My routine",
  "app.phone.title": "Passing + jumping",
  "app.phone.summary": "4 drills · 35 min",
  "app.phone.exerciseOne": "Partner passing",
  "app.phone.exerciseOneSets": "3×10",
  "app.phone.exerciseTwo": "Box jump",
  "app.phone.exerciseTwoSets": "5×3",
  "app.phone.exerciseThree": "Lateral shuffle",
  "app.phone.exerciseThreeSets": "4×30s",
  "app.phone.add": "+ Add drill",
  "app.phone.start": "Start",
  "app.phone.share": "Share",
  "app.features.title": "What you can do",
  "app.features.soon": "Soon",
  "app.features.library.title": "Drill library",
  "app.features.library.text":
    "Every VolleyTip drill on video, organized by skill.",
  "app.features.routine.title": "Build your routine",
  "app.features.routine.text":
    "Pick drills from the library, adjust sets and times, and save it.",
  "app.features.share.title": "Share it",
  "app.features.share.text":
    "Send your routine with a link to your team or your coach, if you want.",
  "app.features.auto.title": "Automatic routine",
  "app.features.auto.text":
    "Tell us what you want to work on and how much time you have, and the app builds the routine for you.",
  "app.features.timers.title": "Timers",
  "app.features.timers.text":
    "Countdown, intervals and sets for your workouts.",
  "app.features.scoreboard.title": "Match scoreboard",
  "app.features.scoreboard.text":
    "Keep the score and the sets of your matches from your phone.",
  "app.features.programs.title": "Training programs",
  "app.features.programs.text":
    "Multi-week plans for goals like vertical jump or strength.",
  "app.features.fixtures.title": "Tournament fixtures",
  "app.features.fixtures.text":
    "Generate the pairings and the schedule of your tournament in seconds.",
  "app.account.title": "One account",
  "app.account.text":
    "The same account works in the app and on the web. What you buy here, like a mini course, you also see on your phone.",
  "app.free.title": "100% free",
  "app.free.text":
    "No subscriptions or in-app payments. Download it and train.",
  "app.faq.title": "Frequently asked questions",
  "app.faq.when.question": "When does the app launch?",
  "app.faq.when.answer":
    "Very soon. Join the waitlist and we will let you know on launch day.",
  "app.faq.free.question": "Is it free?",
  "app.faq.free.answer": "Yes, the app is completely free.",
  "app.faq.devices.question": "Does it work on iPhone and Android?",
  "app.faq.devices.answer":
    "Yes. It will be on the App Store for iPhone and on Google Play for Android.",
  "app.faq.privacy.question": "Who can see my routines?",
  "app.faq.privacy.answer":
    "Only you, unless you decide to share them with a link.",
  "waitlist.emailLabel": "Let me know when it launches",
  "waitlist.emailPlaceholder": "you@email.com",
  "waitlist.countryLabel": "Country",
  "waitlist.submit": "Join the waitlist",
  "waitlist.submitting": "Sending",
  "waitlist.consentStart": "By submitting you accept the ",
  "waitlist.consentLink": "privacy policy",
  "waitlist.consentEnd": ".",
  "waitlist.joined": "Done! We will let you know on launch day.",
  "waitlist.error.email": "Enter a valid email address.",
  "waitlist.error.emailTooLong": "The email address is too long.",
  "waitlist.error.country": "Choose a country from the list.",
  "waitlist.rejected.tooFast": "You submitted the form too fast. Try again.",
  "waitlist.rejected.verification":
    "We could not verify that you are a person. Try again.",
  "waitlist.rejected.rateLimited":
    "Too many attempts. Wait a few minutes and try again.",
};
