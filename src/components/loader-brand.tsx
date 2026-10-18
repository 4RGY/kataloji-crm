// Loader pemuatan halaman. Logo Kataloji bernapas pelan dengan
// cincin tipis berputar. Dipakai saat data sedang diambil.
import Image from "next/image";

export function LoaderBrand({ pesan = "Memuat data..." }: { pesan?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center gap-4 py-16"
    >
      <div className="relative h-24 w-24">
        <span
          aria-hidden
          className="absolute inset-0 animate-spin rounded-full border border-transparent border-t-primary/70"
          style={{ animationDuration: "1.8s" }}
        />
        <Image
          src="/brand/logo-removebg.png"
          alt="Kataloji Coffee and Eatery"
          width={500}
          height={500}
          priority
          className="absolute inset-3 h-[calc(100%-1.5rem)] w-[calc(100%-1.5rem)] animate-pulse object-contain"
          style={{ animationDuration: "2.4s" }}
        />
      </div>
      <p className="text-sm text-muted-foreground">{pesan}</p>
    </div>
  );
}
