import { getLocaleNumberSymbol, NumberSymbol } from '@angular/common';
import { isLanguage, languageFromBrowser, registerAppLocales } from './languages';

describe('languages', () => {
  it.each([
    [['de-CH'], 'de-CH'],
    [['de'], 'de-CH'],
    [['DE-de', 'en'], 'de-CH'],
    [['en-GB', 'de'], 'en-US'],
    [['fr-CH'], 'en-US'],
    [['', 'de-AT'], 'de-CH'],
    [[], 'en-US'],
  ])('maps browser languages %j to %s', (candidates, expected) => {
    expect(languageFromBrowser(candidates)).toBe(expected);
  });

  it('recognizes supported languages only', () => {
    expect(isLanguage('de-CH')).toBe(true);
    expect(isLanguage('en-US')).toBe(true);
    expect(isLanguage('de')).toBe(false);
    expect(isLanguage(null)).toBe(false);
  });

  it('registers locale data for both languages', () => {
    registerAppLocales();
    expect(getLocaleNumberSymbol('de-CH', NumberSymbol.Group)).toBe('’');
    expect(getLocaleNumberSymbol('en-US', NumberSymbol.Group)).toBe(',');
  });
});
