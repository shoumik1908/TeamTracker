import {
  Sunrise,
  Sun,
  Sunset,
  Moon,
  Coffee,
  type LucideIcon,
} from "lucide-react";

export interface GreetingResult {
  text: string;
  Icon: LucideIcon;
}

// Each bracket has a few playful variants so it doesn't feel robotic.
// Picked deterministically by day-of-year so it stays stable across
// re-renders/refreshes within the same day, rather than flickering.
const BRACKETS: {
  startHour: number; // inclusive, 24h
  endHour: number; // exclusive
  Icon: LucideIcon;
  variants: (name: string) => string[];
}[] = [
  {
    startHour: 5,
    endHour: 8,
    Icon: Sunrise,
    variants: (name) => [
      `Up early, ${name}?`,
      `Rise and shine, ${name}`,
      `Morning, ${name} — you beat the sun`,
    ],
  },
  {
    startHour: 8,
    endHour: 12,
    Icon: Sun,
    variants: (name) => [
      `Good morning, ${name}`,
      `Morning, ${name} — let's make it count`,
      `Hey ${name}, ready for today?`,
    ],
  },
  {
    startHour: 12,
    endHour: 14,
    Icon: Coffee,
    variants: (name) => [
      `Good afternoon, ${name}`,
      `Midday check-in, ${name}`,
      `Hope lunch was good, ${name}`,
    ],
  },
  {
    startHour: 14,
    endHour: 18,
    Icon: Sun,
    variants: (name) => [
      `Good afternoon, ${name}`,
      `Afternoon stretch, ${name}`,
      `Keep the momentum, ${name}`,
    ],
  },
  {
    startHour: 18,
    endHour: 22,
    Icon: Sunset,
    variants: (name) => [
      `Good evening, ${name}`,
      `Evening, ${name} — winding down?`,
      `Hey ${name}, one more look before you go?`,
    ],
  },
  {
    startHour: 22,
    endHour: 24,
    Icon: Moon,
    variants: (name) => [
      `Burning the midnight oil, ${name}?`,
      `Still here, ${name}? Respect.`,
      `Night owl mode, ${name}`,
    ],
  },
  {
    startHour: 0,
    endHour: 5,
    Icon: Moon,
    variants: (name) => [
      `Whoa, up late ${name}`,
      `It's the middle of the night, ${name}`,
      `Can't sleep, ${name}?`,
    ],
  },
];

function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function getTimeBasedGreeting(
  name: string,
  date: Date = new Date()
): GreetingResult {
  const hour = date.getHours();
  const bracket =
    BRACKETS.find((b) => hour >= b.startHour && hour < b.endHour) ??
    BRACKETS[1];

  const variants = bracket.variants(name);
  const index = dayOfYear(date) % variants.length;

  return { text: variants[index], Icon: bracket.Icon };
}
