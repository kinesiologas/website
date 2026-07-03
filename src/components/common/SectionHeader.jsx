export function SectionHeader({ eyebrow, title, description, align = 'left' }) {
  const isCentered = align === 'center';

  return (
    <div className={isCentered ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'}>
      {eyebrow ? (
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.28em] text-[var(--color-ruby)]">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="font-serif text-4xl font-semibold leading-tight text-white md:text-5xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-4 text-sm leading-7 text-[var(--color-muted)] md:text-base">{description}</p>
      ) : null}
    </div>
  );
}
