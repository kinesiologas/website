import { MessageCircle } from 'lucide-react';
import { createWhatsAppUrl } from '../../utils/whatsapp.js';

export function WhatsAppButton({ phoneNumber, modelName, className = '' }) {
  return (
    <a
      className={`inline-flex min-h-12 items-center justify-center gap-2 border border-[var(--color-ruby)] bg-[var(--color-ruby)] px-5 text-sm font-semibold uppercase tracking-[0.16em] text-white transition hover:border-[var(--color-ruby-hover)] hover:bg-[var(--color-ruby-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-ruby)] ${className}`}
      href={createWhatsAppUrl(phoneNumber, modelName)}
      target="_blank"
      rel="noreferrer"
      aria-label={`Contactar a ${modelName} por WhatsApp`}
    >
      <MessageCircle aria-hidden="true" size={18} />
      WhatsApp
    </a>
  );
}
