import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getProfileDocumentTitle,
  PROFILE_LOADING_TITLE,
  PROFILE_NOT_FOUND_TITLE,
} from '../src/utils/profileTitle.js';

test('profile title contains name, cellular number and brand', () => {
  assert.equal(
    getProfileDocumentTitle({ name: 'Valentina', whatsappNumber: '51912345678' }),
    'Valentina | 912345678 | KinesiologasS',
  );
});

test('profile title removes the formatted Peru country prefix only', () => {
  assert.equal(
    getProfileDocumentTitle({ name: 'Valentina', whatsapp_number: '+51 912 345 678' }),
    'Valentina | 912 345 678 | KinesiologasS',
  );
  assert.equal(
    getProfileDocumentTitle({ name: 'Valentina', whatsappNumber: '912345678' }),
    'Valentina | 912345678 | KinesiologasS',
  );
});

test('profile title omits an empty cellular number without leaving separators', () => {
  assert.equal(getProfileDocumentTitle({ name: 'Valentina', whatsappNumber: '  ' }), 'Valentina | KinesiologasS');
});

test('profile title exposes stable loading and not-found states', () => {
  assert.equal(PROFILE_LOADING_TITLE, 'Cargando perfil | KinesiologasS');
  assert.equal(getProfileDocumentTitle(null), PROFILE_NOT_FOUND_TITLE);
});
