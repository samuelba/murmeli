import { restoreObjectUrls, stubNavigatorLanguages, stubObjectUrls } from './browser';

beforeEach(() => {
  stubNavigatorLanguages(['de-CH']);
  stubObjectUrls();
});

afterEach(() => restoreObjectUrls());
