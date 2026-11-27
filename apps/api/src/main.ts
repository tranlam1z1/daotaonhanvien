import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { webOrigin } from './auth/auth-policy';
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: webOrigin(),
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    credentials: true,
  });
  app.enableShutdownHooks();
  await app.listen(Number(process.env.API_PORT ?? 4000), '0.0.0.0');
}
void bootstrap();
