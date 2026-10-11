/**
 * Single translation point for API validation message keys and generic API
 * error keys. Unknown keys fall back to a generic message.
 *
 * Keys observed in the API (`UpdateProductRequestValidator`) and generic
 * error handler (`JsonErrorHandler`):
 *   required, <field>.invalidType, <field>.tooLong, price.invalid,
 *   code.unique, brand.notFound, material.notFound,
 *   notFound, methodNotAllowed, httpError, serverError, validationError,
 *   network, aborted, unknown.
 */

/** @type {Record<string, string>} */
const VALIDATION_MESSAGES = {
  required: 'Toto pole je povinné.',
  'code.invalidType': 'Kód musí být text.',
  'code.tooLong': 'Kód může mít nejvýše 20 znaků.',
  'code.unique': 'Produkt s tímto kódem už existuje.',
  'name.invalidType': 'Název musí být text.',
  'name.tooLong': 'Název může mít nejvýše 255 znaků.',
  'description.invalidType': 'Popis musí být text.',
  'description.tooLong': 'Popis může mít nejvýše 5000 znaků.',
  'price.invalid': 'Cena musí být číslo větší než 0, nejvýše na 2 desetinná místa.',
  'brandId.invalidType': 'Značka má neplatný formát.',
  'brand.notFound': 'Zvolená značka neexistuje.',
  'materialId.invalidType': 'Materiál má neplatný formát.',
  'material.notFound': 'Zvolený materiál neexistuje.',
};

/** @type {Record<string, string>} */
const GENERIC_MESSAGES = {
  notFound: 'Požadovaný záznam nebyl nalezen.',
  methodNotAllowed: 'Tato operace není povolena.',
  httpError: 'Požadavek se nezdařil.',
  serverError: 'Na serveru došlo k chybě. Zkuste to prosím znovu.',
  validationError: 'Zadané údaje nejsou platné.',
  network: 'Nepodařilo se spojit se serverem. Zkontrolujte připojení a zkuste to znovu.',
  aborted: 'Požadavek byl přerušen.',
  unknown: 'Nastala neočekávaná chyba.',
};

export const GENERIC_VALIDATION_MESSAGE = 'Zadané údaje nejsou platné.';
export const GENERIC_ERROR_MESSAGE = 'Nastala neočekávaná chyba.';

/**
 * Translate a validation message key to Czech.
 * @param {string} key
 * @returns {string}
 */
export function translateValidationKey(key) {
  return VALIDATION_MESSAGES[key] ?? GENERIC_VALIDATION_MESSAGE;
}

/**
 * Translate a generic API error key to Czech.
 * @param {string} key
 * @returns {string}
 */
export function translateErrorKey(key) {
  return GENERIC_MESSAGES[key] ?? GENERIC_ERROR_MESSAGE;
}
