const defaultMessage = 'Hola, vi tu perfil en el catalogo y quisiera recibir mas informacion.';

export function createWhatsAppUrl(phoneNumber, modelName) {
  const message = modelName
    ? `Hola ${modelName}, vi tu perfil en el catalogo y quisiera recibir mas informacion.`
    : defaultMessage;

  return `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
}
