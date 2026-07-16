export interface HeroProps {
  title: string;
  subtitle: string;
}

const EXPLAINER = [
  {
    label: 'The blur itself',
    body: 'Blurring a pixel just means mixing it with its neighbors — a "kernel" is the recipe for how much each neighbor counts. Gaussian blur uses a bell-curve recipe: closer neighbors count more, farther ones count less.',
  },
  {
    label: 'Why two passes',
    body: 'Averaging in a big square around every pixel is slow. Doing it in two quick sweeps — blur every column, then blur that result across every row — gives the same result with way less math.',
  },
  {
    label: 'Your slider',
    body: "The number of passes never changes — it's always these same two. What changes is how far each pass reaches: low blur looks at 1–2 neighbors, high blur reaches out to 10.",
  },
];

export function Hero({ title, subtitle }: HeroProps) {
  return (
    <header className="w-full border-b border-rule bg-page px-6 py-14 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.1em] text-accent">
          Tool
        </p>
        <h1 className="mb-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          {title}
        </h1>
        <p className="max-w-2xl text-[17px] leading-[1.7] text-muted">{subtitle}</p>

        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {EXPLAINER.map((item) => (
            <div key={item.label}>
              <p className="mb-1.5 font-mono text-xs uppercase tracking-[0.1em] text-faint">
                {item.label}
              </p>
              <p className="text-sm leading-relaxed text-muted">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </header>
  );
}
