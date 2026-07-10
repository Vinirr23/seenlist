"use client";

import Link from "next/link";
import Image from "next/image";
import { Users, MessageSquare } from "lucide-react";
import { MOCK_GROUPS } from "@/lib/mock-groups";

const numberFormatter = new Intl.NumberFormat("pt-BR");

export function ExploreGroupsTab() {
  return (
    <div className="space-y-3 px-4 pt-4 pb-6">
      {MOCK_GROUPS.map((group) => (
        <Link
          key={group.slug}
          href={`/explore/groups/${group.slug}`}
          className="flex items-center gap-3 overflow-hidden rounded-xl border border-border bg-surface"
        >
          <div className="relative h-16 w-16 shrink-0">
            <Image src={group.coverUrl} alt="" fill sizes="64px" loading="lazy" className="object-cover" />
          </div>
          <div className="min-w-0 flex-1 py-2 pr-3">
            <p className="truncate text-sm font-bold text-text">{group.name}</p>
            <div className="mt-1 flex items-center gap-3 text-xs text-muted">
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" strokeWidth={2} />
                {numberFormatter.format(group.members)}
              </span>
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3.5 w-3.5" strokeWidth={2} />
                {numberFormatter.format(group.posts)}
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
