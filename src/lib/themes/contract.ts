import type { TargetAndTransition, Transition } from "framer-motion";
import { THEME_IDS, type ThemeId } from "./ids";

export { THEME_IDS, type ThemeId };

/**
 * Theme contract, layer 3: behaviour. Colours and shapes live in CSS tokens
 * (globals.css); this file holds everything a token can't express: copy,
 * motion, haptics. Visual parts that differ per theme (avatar, background,
 * send glyph, typing indicator, toggle, slider, progress, mood effects) are
 * renderer maps typed Record<ThemeId, ...> in src/components/theme/, so a
 * new theme fails to compile until every component has a variant.
 */
export interface ThemeDef {
  id: ThemeId;
  name: string;
  tagline: string;
  emoji: string;
  /** <meta name="theme-color"> and iOS status bar tint. */
  metaColor: string;
  light: boolean;
  copy: {
    heroTitle: [string, string];
    choose: string;
    placeholder: string;
    placeholderChat: string;
    typing: string;
    emptyChats: string;
    emptyImports: string;
    error: string;
    offline: string;
    swipeHint: string;
  };
  motion: {
    /** whileTap for buttons and chips. */
    press: TargetAndTransition;
    hover: TargetAndTransition;
    bubbleIn: { initial: TargetAndTransition; animate: TargetAndTransition; transition: Transition };
    userIn: { initial: TargetAndTransition; animate: TargetAndTransition; transition: Transition };
    drawer: { initial: TargetAndTransition; animate: TargetAndTransition; exit: TargetAndTransition; transition: Transition };
    /** Rubber-band on the swipe-to-steer gesture. */
    swipeElastic: number;
    /** Feedback while dragging: rotate degrees per 100px. */
    swipeTilt: number;
    roast: TargetAndTransition;
    flex: TargetAndTransition;
  };
  /** navigator.vibrate patterns (ms). iOS Safari ignores them; everything still works. */
  haptics: { tap: number[]; send: number[]; flex: number[]; roast: number[]; swipe: number[]; error: number[] };
}

const spring = (stiffness: number, damping: number): Transition => ({ type: "spring", stiffness, damping });

export const THEMES: Record<ThemeId, ThemeDef> = {
  savage: {
    id: "savage", name: "Savage Dark", tagline: "Neon. Sharp. Zero chill.", emoji: "⚡", metaColor: "#05070d", light: false,
    copy: {
      heroTitle: ["What are we", "breaking today?"], choose: "CHOOSE A PATH", placeholder: "Ask anything", placeholderChat: "Speak your mind...",
      typing: "Mawa is typing", emptyChats: "No chats yet. Say something brave.", emptyImports: "Nothing imported yet.",
      error: "Something broke. Try again.", offline: "Lost the connection. Try again.", swipeHint: "or swipe the reply → / ←",
    },
    motion: {
      press: { scale: 0.92 }, hover: { scale: 1.03 },
      bubbleIn: { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, transition: { type: "tween", ease: "easeOut", duration: 0.3 } },
      userIn: { initial: { opacity: 0, y: 8, scale: 0.98 }, animate: { opacity: 1, y: 0, scale: 1 }, transition: { duration: 0.2 } },
      drawer: { initial: { x: "-100%" }, animate: { x: 0 }, exit: { x: "-100%" }, transition: spring(260, 28) },
      swipeElastic: 0.35, swipeTilt: 0,
      roast: { opacity: [0.9, 1], transition: { duration: 0.4, ease: "easeOut" } },
      flex: { opacity: [0.9, 1], transition: { duration: 0.4, ease: "easeOut" } },
    },
    haptics: { tap: [8], send: [12], flex: [10, 40, 18], roast: [30, 30, 30], swipe: [15], error: [40, 60, 40] },
  },
  nature: {
    id: "nature", name: "Nature", tagline: "Forest calm. Leaves drift. Roasts still sting.", emoji: "🌿", metaColor: "#08150e", light: false,
    copy: {
      heroTitle: ["What shall we", "grow today?"], choose: "PICK A TRAIL", placeholder: "Plant a question", placeholderChat: "Say it, let it grow...",
      typing: "Mawa is sprouting a reply", emptyChats: "Bare soil. Plant your first chat.", emptyImports: "No seeds brought in yet.",
      error: "A branch snapped. Try again.", offline: "Lost the trail. Try again.", swipeHint: "swipe the leaf → hotter / ← softer",
    },
    motion: {
      press: { scale: 0.94, rotate: -2 }, hover: { scale: 1.02, rotate: 1 },
      bubbleIn: { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, transition: { type: "tween", ease: "easeOut", duration: 0.3 } },
      userIn: { initial: { opacity: 0, scale: 0.7, originX: 1, originY: 1 }, animate: { opacity: 1, scale: 1 }, transition: spring(180, 18) },
      drawer: { initial: { x: "-100%", borderTopRightRadius: 200 }, animate: { x: 0, borderTopRightRadius: 40 }, exit: { x: "-100%", borderTopRightRadius: 200 }, transition: spring(140, 22) },
      swipeElastic: 0.5, swipeTilt: 3,
      roast: { opacity: [0.9, 1], transition: { duration: 0.4, ease: "easeOut" } },
      flex: { opacity: [0.9, 1], transition: { duration: 0.4, ease: "easeOut" } },
    },
    haptics: { tap: [5], send: [8, 30, 8], flex: [6, 30, 6, 30, 6], roast: [20, 40, 20], swipe: [10], error: [30, 50, 30] },
  },
  dogs: {
    id: "dogs", name: "Dogs", tagline: "Good boy energy. Bites when roasting.", emoji: "🐶", metaColor: "#fff4e4", light: true,
    copy: {
      heroTitle: ["Who's a good", "question? You are!"], choose: "FETCH A MODE", placeholder: "Throw me a question", placeholderChat: "Woof something...",
      typing: "Mawa is sniffing out a reply", emptyChats: "No chats yet. Throw the ball!", emptyImports: "Nothing fetched yet.",
      error: "Ruff, I dropped it. Try again.", offline: "Leash snapped. Try again.", swipeHint: "swipe → for bite, ← for belly rubs",
    },
    motion: {
      press: { scale: 0.86, rotate: 6 }, hover: { scale: 1.06, rotate: -3 },
      bubbleIn: { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, transition: { type: "tween", ease: "easeOut", duration: 0.3 } },
      userIn: { initial: { opacity: 0, x: 40, scale: 0.85 }, animate: { opacity: 1, x: 0, scale: 1 }, transition: spring(420, 16) },
      drawer: { initial: { x: "-100%", rotate: -4 }, animate: { x: 0, rotate: 0 }, exit: { x: "-100%", rotate: -4 }, transition: spring(380, 18) },
      swipeElastic: 0.6, swipeTilt: 6,
      roast: { opacity: [0.9, 1], transition: { duration: 0.4, ease: "easeOut" } },
      flex: { opacity: [0.9, 1], transition: { duration: 0.4, ease: "easeOut" } },
    },
    haptics: { tap: [6, 20, 6], send: [10, 25, 10], flex: [8, 20, 8, 20, 8, 20, 8], roast: [35, 25, 35], swipe: [12, 20, 12], error: [50, 40, 50] },
  },
  horses: {
    id: "horses", name: "Horses", tagline: "Saddle leather, gold trim, galloping wit.", emoji: "🐎", metaColor: "#efe3c8", light: true,
    copy: {
      heroTitle: ["Where shall we", "ride today?"], choose: "CHOOSE YOUR STRIDE", placeholder: "Saddle up a question", placeholderChat: "Give it a nudge...",
      typing: "Mawa is trotting over", emptyChats: "An empty stable. Ride out.", emptyImports: "No herds brought home yet.",
      error: "Thrown from the saddle. Try again.", offline: "Lost the reins. Try again.", swipeHint: "spur → for heat, rein ← for grace",
    },
    motion: {
      press: { scale: 0.95, y: 1 }, hover: { scale: 1.02 },
      bubbleIn: { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, transition: { type: "tween", ease: "easeOut", duration: 0.3 } },
      userIn: { initial: { opacity: 0, x: 36 }, animate: { opacity: 1, x: 0 }, transition: { type: "tween", ease: [0.22, 1, 0.36, 1], duration: 0.5 } },
      drawer: { initial: { x: "-100%", opacity: 0.6 }, animate: { x: 0, opacity: 1 }, exit: { x: "-100%", opacity: 0.6 }, transition: { type: "tween", ease: [0.22, 1, 0.36, 1], duration: 0.5 } },
      swipeElastic: 0.25, swipeTilt: 0,
      roast: { opacity: [0.9, 1], transition: { duration: 0.4, ease: "easeOut" } },
      flex: { opacity: [0.9, 1], transition: { duration: 0.4, ease: "easeOut" } },
    },
    haptics: { tap: [10], send: [14, 60, 14, 60], flex: [12, 80, 12, 80, 12], roast: [25, 70, 25], swipe: [14], error: [40, 60, 40] },
  },
  cosmic: {
    id: "cosmic", name: "Cosmic", tagline: "Starry nights with a round robo-cat pal.", emoji: "🪐", metaColor: "#030824", light: false,
    copy: {
      heroTitle: ["Which galaxy", "are we exploring?"], choose: "PICK A STAR", placeholder: "Beam up a question", placeholderChat: "Transmit...",
      typing: "Mawa is receiving signals", emptyChats: "Empty space. Launch a chat.", emptyImports: "No signals imported yet.",
      error: "Signal lost in a nebula. Try again.", offline: "Out of orbit. Try again.", swipeHint: "swipe → supernova, ← moonlight",
    },
    motion: {
      press: { scale: 0.9 }, hover: { scale: 1.04 },
      bubbleIn: { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, transition: { type: "tween", ease: "easeOut", duration: 0.3 } },
      userIn: { initial: { opacity: 0, y: 16, filter: "blur(4px)" }, animate: { opacity: 1, y: 0, filter: "blur(0px)" }, transition: { duration: 0.35 } },
      drawer: { initial: { x: "-100%", opacity: 0, filter: "blur(8px)" }, animate: { x: 0, opacity: 1, filter: "blur(0px)" }, exit: { x: "-100%", opacity: 0, filter: "blur(8px)" }, transition: spring(200, 26) },
      swipeElastic: 0.45, swipeTilt: 2,
      roast: { opacity: [0.9, 1], transition: { duration: 0.4, ease: "easeOut" } },
      flex: { opacity: [0.9, 1], transition: { duration: 0.4, ease: "easeOut" } },
    },
    haptics: { tap: [6], send: [4, 20, 4, 20, 20], flex: [6, 15, 6, 15, 6, 15, 30], roast: [25, 25, 25], swipe: [10], error: [40, 40, 40] },
  },
  mountains: {
    id: "mountains", name: "Mountains", tagline: "Misty peaks, crisp air, summit-level burns.", emoji: "🏔️", metaColor: "#141d2a", light: false,
    copy: {
      heroTitle: ["Which peak are", "we climbing today?"], choose: "CHOOSE A ROUTE", placeholder: "Call out a question", placeholderChat: "Shout it across the valley...",
      typing: "Mawa is climbing to an answer", emptyChats: "Fresh snow. Leave the first tracks.", emptyImports: "No trails brought over yet.",
      error: "Rockslide. Try again.", offline: "No signal up here. Try again.", swipeHint: "swipe → avalanche, ← gentle breeze",
    },
    motion: {
      press: { scale: 0.95, y: 2 }, hover: { y: -2 },
      bubbleIn: { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, transition: { type: "tween", ease: "easeOut", duration: 0.3 } },
      userIn: { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { type: "tween", ease: [0.16, 1, 0.3, 1], duration: 0.45 } },
      drawer: { initial: { x: "-100%" }, animate: { x: 0 }, exit: { x: "-100%" }, transition: { type: "tween", ease: [0.16, 1, 0.3, 1], duration: 0.55 } },
      swipeElastic: 0.3, swipeTilt: 1,
      roast: { opacity: [0.9, 1], transition: { duration: 0.4, ease: "easeOut" } },
      flex: { opacity: [0.9, 1], transition: { duration: 0.4, ease: "easeOut" } },
    },
    haptics: { tap: [8], send: [10, 40, 20], flex: [10, 50, 10, 50, 30], roast: [40, 30, 20, 30, 10], swipe: [12], error: [50, 50, 50] },
  },
  mani: {
    id: "mani", name: "Mani Mode", tagline: "Telangana twilight, gold constellations, a co-pilot cat.", emoji: "✦", metaColor: "#b9592a", light: false,
    copy: {
      heroTitle: ["Ready when you are,", "mawa."], choose: "PICK A LINE", placeholder: "say something.", placeholderChat: "say something.",
      typing: "Mawa is thinking", emptyChats: "Nothing here yet. Ship the first one.", emptyImports: "Nothing imported yet.",
      error: "That did not land. Try again, mawa.", offline: "Lost the thermal. Try again.", swipeHint: "swipe right for heat, left for calm",
    },
    motion: {
      // Premium and small: 200-300ms ease-outs, no bounce spam.
      press: { scale: 0.96 }, hover: { scale: 1.02 },
      bubbleIn: { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, transition: { type: "tween", ease: "easeOut", duration: 0.3 } },
      userIn: { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { type: "tween", ease: "easeOut", duration: 0.22 } },
      drawer: { initial: { x: "-100%", opacity: 0.8 }, animate: { x: 0, opacity: 1 }, exit: { x: "-100%", opacity: 0.8 }, transition: { type: "tween", ease: "easeOut", duration: 0.28 } },
      swipeElastic: 0.3, swipeTilt: 0,
      roast: { opacity: [0.9, 1], transition: { duration: 0.4, ease: "easeOut" } },
      flex: { opacity: [0.9, 1], transition: { duration: 0.4, ease: "easeOut" } },
    },
    haptics: { tap: [6], send: [8, 30, 14], flex: [8, 30, 8], roast: [18, 30, 18], swipe: [10], error: [30, 40, 30] },
  },
  calm: {
    id: "calm", name: "Calm", tagline: "Quiet colours. No drama. Room to think.", emoji: "○", metaColor: "#14171c", light: false,
    copy: {
      heroTitle: ["No rush.", "What's on your mind?"], choose: "PICK A PATH", placeholder: "Type whenever you're ready", placeholderChat: "Type whenever you're ready",
      typing: "Mawa is thinking", emptyChats: "A quiet place to start. Write whenever you're ready.", emptyImports: "Nothing imported yet.",
      error: "That didn't land. Try again when you're ready.", offline: "Lost the connection. Try again.", swipeHint: "swipe right for more heat, left for softer",
    },
    motion: {
      press: { scale: 0.98 }, hover: { scale: 1.01 },
      bubbleIn: { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, transition: { type: "tween", ease: "easeOut", duration: 0.3 } },
      userIn: { initial: { opacity: 0, y: 4 }, animate: { opacity: 1, y: 0 }, transition: { type: "tween", ease: "easeOut", duration: 0.22 } },
      drawer: { initial: { x: "-100%", opacity: 0.9 }, animate: { x: 0, opacity: 1 }, exit: { x: "-100%", opacity: 0.9 }, transition: { type: "tween", ease: "easeOut", duration: 0.28 } },
      swipeElastic: 0.2, swipeTilt: 0,
      roast: { opacity: [0.9, 1], transition: { duration: 0.4, ease: "easeOut" } },
      flex: { opacity: [0.9, 1], transition: { duration: 0.4, ease: "easeOut" } },
    },
    haptics: { tap: [4], send: [6], flex: [5], roast: [8], swipe: [5], error: [12, 20, 12] },
  },
};
