import Link from "next/link";
import { LINKS, DELPHI_CONTRACT } from "@/lib/constants";

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-800 bg-slate-950/50">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-sm text-slate-400">
            Tracking{" "}
            <Link href={LINKS.contract} target="_blank" className="text-cyan-400 hover:text-purple-400 font-mono">
              {DELPHI_CONTRACT.slice(0, 10)}...
            </Link>
          </div>
          <div className="flex gap-6 text-sm">
            <Link href={LINKS.delphi} target="_blank" className="text-slate-400 hover:text-white">
              Delphi Markets
            </Link>
            <Link href={LINKS.explorer} target="_blank" className="text-slate-400 hover:text-white">
              Explorer
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
