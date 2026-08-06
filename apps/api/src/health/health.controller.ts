import { Controller, Get } from '@nestjs/common';

import { Public } from '../auth/auth.decorators';

@Controller('health')
export class HealthController {
  /** Liveness probe — precisa responder sem credencial. */
  @Public()
  @Get()
  health() {
    return { status: 'ok', uptime: Math.round(process.uptime()) };
  }
}
