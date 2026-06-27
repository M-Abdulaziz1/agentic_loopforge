export function Placeholder({ title }: { title: string }) {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-extrabold">{title}</h1>
      <p className="mt-2 text-mut">Coming soon.</p>
    </div>
  );
}
