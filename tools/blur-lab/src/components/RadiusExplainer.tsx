export interface RadiusExplainerProps {
  radius: number;
  kernelSize: number;
}

export function RadiusExplainer({ radius, kernelSize }: RadiusExplainerProps) {
  const text =
    radius === 0
      ? 'radius 0: no blur — each pixel keeps its own value.'
      : `radius ${radius}: each pixel blends with ${radius} neighbor${
          radius === 1 ? '' : 's'
        } on each side (${kernelSize} total, weighted by a Gaussian curve).`;

  return <p className="font-mono text-sm leading-relaxed text-muted">{text}</p>;
}
