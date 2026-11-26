import {
  ExecutionContext,
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ThrottlerException,
  ThrottlerGuard,
  type ThrottlerLimitDetail,
  type ThrottlerRequest,
} from '@nestjs/throttler';
import { errorMessage } from '../common/errors/error-message';
import { FAIL_CLOSED_THROTTLERS } from './auth-throttle.decorator';

export const RATE_LIMIT_UNAVAILABLE = 'RATE_LIMIT_UNAVAILABLE';

/**
 * When the rate-limit store is unreachable, ordinary routes stay available
 * (fail open) while auth routes refuse requests (fail closed), so an outage
 * cannot be used to brute-force credentials.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected override async handleRequest(
    requestProps: ThrottlerRequest,
  ): Promise<boolean> {
    try {
      return await super.handleRequest(requestProps);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      const name = requestProps.throttler.name ?? 'default';
      if (FAIL_CLOSED_THROTTLERS.has(name)) {
        this.logger.error(
          `Rate limit store unavailable, rejecting auth request: ${errorMessage(error)}`,
        );
        throw new ServiceUnavailableException({
          errorCode: RATE_LIMIT_UNAVAILABLE,
          message: 'Rate limiting is temporarily unavailable',
        });
      }
      this.logger.warn(
        `Rate limit store unavailable, allowing request (${name}): ${errorMessage(error)}`,
      );
      return true;
    }
  }

  protected override throwThrottlingException(
    context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    const { res } = this.getRequestResponse(context);
    this.setResponseHeader(
      res,
      'Retry-After',
      Math.max(1, detail.timeToBlockExpire),
    );
    throw new ThrottlerException('Too many requests');
  }
}
