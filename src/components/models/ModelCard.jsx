import { ArrowRight, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

export function ModelCard({ profile }) {
  return (
    <motion.article
      className="group border border-[var(--color-border)] bg-[var(--color-surface)]"
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
    >
      <Link
        className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-ruby)]"
        to={`/perfil/${profile.slug}`}
        aria-label={`Ver perfil de ${profile.name}`}
      >
        <div className="aspect-[4/5] overflow-hidden bg-[#0f0f0f]">
          <img
            className="h-full w-full object-cover opacity-95 transition duration-700 group-hover:scale-[1.03] group-hover:opacity-100"
            src={profile.profileImage}
            alt={`Retrato de ${profile.name}`}
            loading="lazy"
          />
        </div>
        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-serif text-3xl font-semibold text-white">{profile.name}</h3>
              <p className="mt-2 flex items-center gap-2 text-sm text-[var(--color-muted)]">
                <MapPin aria-hidden="true" size={15} />
                {profile.city} &middot; {profile.age}
              </p>
            </div>
            <span className="border border-[var(--color-border)] px-3 py-1 text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
              {profile.category}
            </span>
          </div>
          <p className="mt-4 line-clamp-2 text-sm leading-6 text-[var(--color-muted)]">
            {profile.shortDescription}
          </p>
          <span className="mt-5 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-ruby)] transition group-hover:text-[var(--color-ruby-hover)]">
            Ver perfil
            <ArrowRight aria-hidden="true" size={16} />
          </span>
        </div>
      </Link>
    </motion.article>
  );
}
