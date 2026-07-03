import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SectionHeader } from '../components/common/SectionHeader.jsx';

export default function Contact() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl items-center px-5 py-28 text-center md:px-8">
      <section className="w-full">
        <SectionHeader
          align="center"
          eyebrow="Contacto"
          title="Contacto directo desde cada perfil"
          description="Para mantener una experiencia privada y limpia, cada modelo tiene su propio boton de WhatsApp dentro del perfil. El numero no se muestra en pantalla."
        />
        <Link
          className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 border border-[var(--color-ruby)] bg-[var(--color-ruby)] px-5 text-sm font-semibold uppercase tracking-[0.16em] text-white transition hover:border-[var(--color-ruby-hover)] hover:bg-[var(--color-ruby-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-ruby)]"
          to="/modelos"
        >
          Elegir modelo
          <ArrowRight aria-hidden="true" size={18} />
        </Link>
      </section>
    </main>
  );
}
