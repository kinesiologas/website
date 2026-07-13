import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { GalleryGrid } from '../components/gallery/GalleryGrid.jsx';
import { HomeHeroMedia } from '../components/home/HomeHeroMedia.jsx';
import { ModelCard } from '../components/models/ModelCard.jsx';
import { SectionHeader } from '../components/common/SectionHeader.jsx';
import { getGalleryPreviewImages } from '../services/galleryService.js';
import { getFeaturedProfiles } from '../services/profileService.js';
import { getPublicSiteSettings, resolveSiteMediaUrl } from '../services/siteMediaService.js';

export default function Home() {
  const [featuredProfiles, setFeaturedProfiles] = useState([]);
  const [previewImages, setPreviewImages] = useState([]);
  const [siteSettings, setSiteSettings] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadHomeData() {
      const [profiles, images, settings] = await Promise.all([
        getFeaturedProfiles(3),
        getGalleryPreviewImages(6),
        getPublicSiteSettings(),
      ]);

      if (isMounted) {
        setFeaturedProfiles(profiles);
        setPreviewImages(images);
        setSiteSettings(settings);
        setIsLoading(false);
      }
    }

    loadHomeData();

    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 text-sm uppercase tracking-[0.18em] text-[var(--color-muted)]">
        Cargando catalogo...
      </main>
    );
  }

  return (
    <main>
      <section className="relative flex min-h-screen items-end overflow-hidden px-5 pb-16 pt-28 md:px-8 md:pb-24">
        <HomeHeroMedia settings={siteSettings} resolveMediaUrl={resolveSiteMediaUrl} />
        <div className="absolute inset-0 bg-gradient-to-t from-[#090909] via-[#090909]/68 to-[#090909]/35" />
        <div className="relative mx-auto flex min-h-[72vh] w-full max-w-7xl items-end">
          <div className="max-w-3xl">
            <p className="mb-4 text-xs font-medium uppercase tracking-[0.32em] text-[var(--color-ruby)]">
              Catalogo editorial
            </p>
            <h1 className="font-serif text-5xl font-semibold leading-tight text-white md:text-7xl">
              Modelos seleccionadas con estetica premium
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-[#d7d7d7] md:text-lg">
              Explora perfiles cuidados, galerias amplias y contacto directo por WhatsApp en una experiencia visual sobria y rapida.
            </p>
            <Link
              className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 border border-[var(--color-ruby)] bg-[var(--color-ruby)] px-5 text-sm font-semibold uppercase tracking-[0.16em] text-white transition hover:border-[var(--color-ruby-hover)] hover:bg-[var(--color-ruby-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-ruby)]"
              to="/modelos"
            >
              Explorar modelos
              <ArrowRight aria-hidden="true" size={18} />
            </Link>
          </div>
        </div>
      </section>

      <section className="px-5 py-20 md:px-8 md:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <SectionHeader
              eyebrow="Seleccion"
              title="Modelos destacadas"
              description="Perfiles publicados desde Supabase con imagenes servidas desde R2 y respaldo local para desarrollo."
            />
            <Link
              className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-ruby)] transition hover:text-[var(--color-ruby-hover)]"
              to="/modelos"
            >
              Ver todas
              <ArrowRight aria-hidden="true" size={16} />
            </Link>
          </div>
          {featuredProfiles.length ? (
            <div className="grid gap-5 md:grid-cols-3">
              {featuredProfiles.map((profile) => (
                <ModelCard key={profile.id} profile={profile} />
              ))}
            </div>
          ) : (
            <p className="border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-[var(--color-muted)]">
              No hay perfiles destacados publicados en este momento.
            </p>
          )}
        </div>
      </section>

      <section className="border-y border-[var(--color-border)] bg-[#0b0b0b] px-5 py-20 md:px-8 md:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10">
            <SectionHeader
              eyebrow="Galeria"
              title="Vista previa fotografica"
              description="Un recorrido visual breve para validar el ritmo editorial antes de cargar fotografias reales."
            />
          </div>
          <GalleryGrid images={previewImages} compact />
        </div>
      </section>

      <section className="px-5 py-20 md:px-8 md:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <SectionHeader
            align="center"
            eyebrow="Contacto directo"
            title="Elige un perfil y abre WhatsApp"
            description="Cada modelo conserva su propio enlace directo para iniciar la conversacion por WhatsApp."
          />
          <Link
            className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 border border-[var(--color-ruby)] bg-[var(--color-ruby)] px-5 text-sm font-semibold uppercase tracking-[0.16em] text-white transition hover:border-[var(--color-ruby-hover)] hover:bg-[var(--color-ruby-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-ruby)]"
            to="/modelos"
          >
            Ver catalogo
            <ArrowRight aria-hidden="true" size={18} />
          </Link>
        </div>
      </section>
    </main>
  );
}
