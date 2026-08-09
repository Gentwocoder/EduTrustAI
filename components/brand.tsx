import Image from "next/image";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white shadow-sm">
        <Image src="/favicon.svg" alt="" width={24} height={24} priority />
      </span>
      {!compact && (
        <span className="text-base font-semibold tracking-tight text-slate-950">
          EduTrust <span className="text-blue-600">AI</span>
        </span>
      )}
    </span>
  );
}
