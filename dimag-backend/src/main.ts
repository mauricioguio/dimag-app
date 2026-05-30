import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: (origin, callback) => {
      const local = !origin || /^http:\/\/localhost:\d+$/.test(origin);
      const allowed = (process.env.ALLOWED_ORIGINS ?? '').split(',').map(s => s.trim()).filter(Boolean);
      if (local || allowed.includes(origin!)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });

  app.setGlobalPrefix('api');

  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/ping', (_req: any, res: any) => res.send('ok'));

  await app.listen(process.env.PORT ?? 3000);
  console.log(`DIMAG backend corriendo en puerto ${process.env.PORT ?? 3000}`);
}
bootstrap();
