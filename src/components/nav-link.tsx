"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavLink({
  href,
  children,
  exact,
}: {
  href: string;
  children: React.ReactNode;
  /** Match this path only — for section landing pages whose siblings sit under it. */
  exact?: boolean;
}) {
  const pathname = usePathname();
  const active =
    pathname === href || (!exact && href !== "/app" && pathname.startsWith(href));
  return (
    <Link
      href={href}
      className={cn(
        "rounded-md px-3 py-2 text-sm transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
