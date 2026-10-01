import { registerDictionary } from '../i18n'

/**
 * hi translations. Key -> translated string, keys as in keys.en.json.
 * Filled by the i18n extraction/translation pass; empty means "fall back to English".
 */
export const dictionary: Record<string, string> = {}

registerDictionary('hi', dictionary)
export default dictionary
