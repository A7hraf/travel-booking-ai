"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/** <details> dropdown that closes itself after navigating (the layout, and so the menu, persists across pages). */
export function MobileMenu({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();
  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [pathname]);

  return (
    <details ref={ref} className="group relative md:hidden">
      <summary className="btn list-none [&::-webkit-details-marker]:hidden" aria-label="Menu">
        <span className="group-open:hidden">☰ Menu</span>
        <span className="hidden group-open:inline">✕ Close</span>
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-64 space-y-1 rounded-xl border border-gray-200 bg-white p-3 shadow-lg">{children}</div>
    </details>
  );
}
