import { useEffect, useState } from 'react';
import { ArrowLeft, Instagram, MapPin } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { WhatsAppButton } from '../components/contact/WhatsAppButton.jsx';
import { GalleryGrid } from '../components/gallery/GalleryGrid.jsx';
import { SectionHeader } from '../components/common/SectionHeader.jsx';
import { PublicAvailabilityCalendar } from '../components/availability/PublicAvailabilityCalendar.jsx';
import { getGalleryByModelSlug } from '../services/galleryService.js';
import { getProfileBySlug } from '../services/profileService.js';

export default function Profile() {
  const { slug } = useParams();
  const [profile, setProfile] = useState(null);
  const [gallery, setGallery] = useState({ modelSlug: slug, images: [] });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadProfileData() {
      setIsLoading(true);

      const [nextProfile, nextGallery] = await Promise.all([getProfileBySlug(slug), getGalleryByModelSlug(slug)]);

      if (isMounted) {
        setProfile(nextProfile);
        setGallery(nextGallery);
        setIsLoading(false);
      }
    }

    loadProfileData();

    return () => {
      isMounted = false;
    };
  }, [slug]);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 text-sm uppercase tracking-[0.18em] text-[var(--color-muted)]">
        Cargando perfil...
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="mx-auto min-h-screen max-w-4xl px-5 py-32 md:px-8 md:py-40">
        <Link
          className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-ruby)] transition hover:text-[var(--color-ruby-hover)]"
          to="/modelos"
        >
          <ArrowLeft aria-hidden="true" size={16} />
          Volver a modelos
        </Link>
        <h1 className="mt-8 font-serif text-4xl font-semibold text-white md:text-6xl">
          Perfil no disponible
        </h1>
        <p className="mt-4 max-w-2xl text-[var(--color-muted)]">
          El perfil solicitado no existe en los datos actuales.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <section className="relative min-h-[72vh] overflow-hidden px-5 pb-10 pt-28 md:px-8 md:pb-16">
        <img
          className="absolute inset-0 h-full w-full object-cover opacity-68"
          src={profile.coverImage}
          alt={`Portada de ${profile.name}`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#090909] via-[#090909]/76 to-[#090909]/35" />
        <div className="relative mx-auto flex min-h-[58vh] max-w-7xl items-end">
          <div className="grid w-full gap-8 md:grid-cols-[220px_1fr] md:items-end">
            <div className="aspect-[4/5] max-w-[220px] overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface)]">
              <img
                className="h-full w-full object-cover"
                src={profile.profileImage}
                alt={`Retrato de ${profile.name}`}
              />
            </div>
            <div>
              <Link
                className="mb-6 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-ruby)] transition hover:text-[var(--color-ruby-hover)]"
                to="/modelos"
              >
                <ArrowLeft aria-hidden="true" size={16} />
                Volver
              </Link>
              <p className="mb-3 text-xs font-medium uppercase tracking-[0.28em] text-[var(--color-ruby)]">
                {profile.category}
              </p>
              <h1 className="font-serif text-5xl font-semibold leading-tight text-white md:text-7xl">
                {profile.name}
              </h1>
              <p className="mt-4 flex items-center gap-2 text-sm text-[#d7d7d7]">
                <MapPin aria-hidden="true" size={16} />
                {profile.city} &middot; {profile.age}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-5 py-14 md:grid-cols-[1fr_320px] md:px-8 md:py-20">
        <div>
          <SectionHeader eyebrow="Perfil" title="Descripcion" />
          <p className="mt-6 max-w-3xl text-base leading-8 text-[var(--color-muted)]">{profile.description}</p>
        </div>
        <aside className="h-fit border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">Contacto privado</p>
          <WhatsAppButton className="mt-5 w-full" phoneNumber={profile.whatsappNumber} modelName={profile.name} />
          <a
            className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 border border-[var(--color-border)] px-5 text-sm font-semibold uppercase tracking-[0.16em] text-white transition hover:border-[var(--color-ruby)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-ruby)]"
            href={profile.instagramUrl}
            target="_blank"
            rel="noreferrer"
          >
            <Instagram aria-hidden="true" size={18} />
            Instagram
          </a>
        </aside>
      </section>

      <PublicAvailabilityCalendar modelId={profile.id} modelName={profile.name} modelSlug={profile.slug} />

      <section className="border-t border-[var(--color-border)] px-5 py-16 md:px-8 md:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10">
            <SectionHeader
              eyebrow="Galeria"
              title={`Fotografias de ${profile.name}`}
              description="Al pulsar una imagen se abre el visor con navegacion entre fotografias."
            />
          </div>
          <GalleryGrid images={gallery.images} />
        </div>
      </section>
    </main>
  );
}
