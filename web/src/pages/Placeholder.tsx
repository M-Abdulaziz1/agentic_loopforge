export function Placeholder({ title }: { title: string }) {
  return (
    <div className="p-8">
      <h1 className="font-display text-[30px] leading-none text-ink">{title}</h1>
      <p className="mt-2 text-mut">Coming soon.</p>
    </div>
  );
}
