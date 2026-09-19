import { useEffect, useState } from "react";
import { getTimeBasedGreeting } from "../lib/greeting";

interface DashboardGreetingProps {
  name: string;
  className?: string;
}

export function DashboardGreeting({ name, className }: DashboardGreetingProps) {
  const [greeting, setGreeting] = useState(() => getTimeBasedGreeting(name));
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Recompute on the next hour boundary (and every hour after) so a
    // dashboard left open overnight doesn't get stuck on a stale greeting.
    const msUntilNextHour =
      (60 - new Date().getMinutes()) * 60 * 1000 -
      new Date().getSeconds() * 1000;

    // TT-124: the `return () => clearInterval(interval)` used to sit inside the setTimeout
    // callback, where React never sees it — setTimeout discards whatever its callback
    // returns. The effect's own cleanup only cleared the timeout, so once the first hour
    // boundary passed the interval leaked for the life of the tab and kept calling
    // setGreeting on an unmounted component. The handle is now held where the cleanup can
    // reach it.
    let interval: ReturnType<typeof setInterval> | undefined;

    const timeout = setTimeout(() => {
      setGreeting(getTimeBasedGreeting(name));
      interval = setInterval(
        () => setGreeting(getTimeBasedGreeting(name)),
        60 * 60 * 1000
      );
    }, msUntilNextHour);

    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, [name]);

  const { text, Icon } = greeting;

  return (
    <div
      className={`flex items-center gap-2.5 transition-all duration-500 ease-out ${
        mounted ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1"
      } ${className ?? ""}`}
    >
      <Icon className="h-5 w-5 shrink-0 text-primary" strokeWidth={2} />
      <h1 className="text-xl font-medium tracking-tight">{text}</h1>
    </div>
  );
}
