import { useEffect, useState } from 'react';
import { ModelCard } from '../components/models/ModelCard.jsx';
import { SectionHeader } from '../components/common/SectionHeader.jsx';
import { getCategories } from '../services/categoryService.js';
import { getProfiles } from '../services/profileService.js';

export default function Models() {
  const [profiles, setProfiles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadModelsData() {
      const [nextProfiles, nextCategories] = await Promise.all([getProfiles(), getCategories()]);

      if (isMounted) {
        setProfiles(nextProfiles);
        setCategories(nextCategories);
        setIsLoading(false);
      }
    }

    loadModelsData();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-5 py-28 md:px-8 md:py-36">
      <div className="mb-10 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <SectionHeader
          eyebrow="Catalogo"
          title="Modelos"
          description="Perfiles cargados desde Supabase con galerias optimizadas en R2."
        />
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <span
              key={category.id}
              className="border border-[var(--color-border)] px-3 py-2 text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]"
            >
              {category.label}
            </span>
          ))}
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm uppercase tracking-[0.18em] text-[var(--color-muted)]">Cargando modelos...</p>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {profiles.map((profile) => (
            <ModelCard key={profile.id} profile={profile} />
          ))}
        </div>
      )}
    </main>
  );
}
