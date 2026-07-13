export const PROFILE_LOADING_TITLE = 'Cargando perfil | KinesiologasS';
export const PROFILE_NOT_FOUND_TITLE = 'Perfil no disponible | KinesiologasS';

function getLocalPhoneNumber(phoneNumber) {
  return String(phoneNumber ?? '')
    .trim()
    .replace(/^\+?51[\s().-]*/, '')
    .trim();
}

export function getProfileDocumentTitle(profile) {
  const name = profile?.name?.trim();

  if (!name) {
    return PROFILE_NOT_FOUND_TITLE;
  }

  const phoneNumber = getLocalPhoneNumber(profile.whatsappNumber ?? profile.whatsapp_number);

  return phoneNumber
    ? `${name} | ${phoneNumber} | KinesiologasS`
    : `${name} | KinesiologasS`;
}
