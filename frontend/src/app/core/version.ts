// A named import keeps only the version string in the bundle (release-please bumps it).
import { version } from '../../../package.json';

export const APP_VERSION: string = version;
