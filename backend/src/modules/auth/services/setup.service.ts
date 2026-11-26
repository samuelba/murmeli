import {
  HttpStatus,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { safeEqual, sha256Hex } from '../../../common/crypto/secure-token';
import { apiError } from '../../../common/errors/api-exception';
import { errorMessage } from '../../../common/errors/error-message';
import type { Env } from '../../../config/env.schema';
import { UserEntity } from '../../users/user.entity';
import { UsersService } from '../../users/users.service';
import type { SetupDto } from '../dto/auth.dto';
import { PasswordService } from '../passwords/password.service';

export const SETUP_LOCK_ID = 7_201_814_310;

export const OPEN_SETUP_WARNING =
  'No user exists yet and SETUP_TOKEN is not set: whoever reaches /api/auth/setup first becomes the admin. Finish the setup now or set SETUP_TOKEN.';

function setupComplete() {
  return apiError(
    HttpStatus.FORBIDDEN,
    'SETUP_COMPLETE',
    'Setup is already complete',
  );
}

/**
 * Creates the first admin while the users table is empty. A transaction-level
 * advisory lock serialises concurrent setup requests. With SETUP_TOKEN set,
 * the request must also carry that token.
 */
@Injectable()
export class SetupService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SetupService.name);
  private readonly setupToken: string | undefined;
  private readonly isProduction: boolean;

  constructor(
    private readonly dataSource: DataSource,
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    config: ConfigService<Env, true>,
  ) {
    this.setupToken = config.get('SETUP_TOKEN', { infer: true });
    this.isProduction =
      config.get('NODE_ENV', { infer: true }) === 'production';
  }

  get tokenRequired(): boolean {
    return this.setupToken !== undefined;
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.isProduction || this.tokenRequired) {
      return;
    }
    try {
      if (await this.isRequired()) {
        this.logger.warn(OPEN_SETUP_WARNING);
      }
    } catch (error) {
      this.logger.warn(
        `Could not check the setup state: ${errorMessage(error)}`,
      );
    }
  }

  async isRequired(): Promise<boolean> {
    return (await this.users.count()) === 0;
  }

  async createFirstAdmin(dto: SetupDto): Promise<UserEntity> {
    if (!(await this.isRequired())) {
      throw setupComplete();
    }
    this.assertSetupToken(dto.setupToken);
    await this.passwords.assertAcceptable(dto.password);
    const passwordHash = await this.passwords.hash(dto.password);
    return this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock($1)', [SETUP_LOCK_ID]);
      if ((await manager.count(UserEntity)) > 0) {
        throw setupComplete();
      }
      return this.users.create(
        {
          email: dto.email,
          passwordHash,
          locale: dto.locale,
          role: 'admin',
          emailVerifiedAt: new Date(),
        },
        manager,
      );
    });
  }

  private assertSetupToken(provided: string | undefined): void {
    if (this.setupToken === undefined) {
      return;
    }
    if (!safeEqual(sha256Hex(provided ?? ''), sha256Hex(this.setupToken))) {
      throw apiError(
        HttpStatus.FORBIDDEN,
        'SETUP_TOKEN_INVALID',
        'The setup token is missing or wrong',
      );
    }
  }
}
