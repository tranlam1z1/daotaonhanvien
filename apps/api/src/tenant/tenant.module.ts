import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TenantDatabase } from './tenant-database';
import { TenantInterceptor } from './tenant.interceptor';

@Global()
@Module({
  providers: [
    TenantDatabase,
    { provide: APP_INTERCEPTOR, useClass: TenantInterceptor },
  ],
  exports: [TenantDatabase],
})
export class TenantModule {}
