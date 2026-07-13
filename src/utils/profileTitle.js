export const PROFILE_LOADING_TITLE = 'Cargando perfil | KinesiologasS';
export const PROFILE_NOT_FOUND_TITLE = 'Perfil no disponible | KinesiologasS';

export function getProfileDocumentTitle(profile) {
  const name = profile?.name?.trim();

  if (!name) {
    return PROFILE_NOT_FOUND_TITLE;
  }

  const phoneNumber = String(profile.whatsappNumber ?? profile.whatsapp_number ?? '').trim();

  return phoneNumber
    ? `${name} | ${phoneNumber} | KinesiologasS`
    : `${name} | KinesiologasS`;
}
