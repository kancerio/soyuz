import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Включаем глобальную валидацию
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,           // удаляет поля, которых нет в DTO
    forbidNonWhitelisted: true, // выбрасывает ошибку при лишних полях
    transform: true,           // автоматически преобразует типы
  }));
  
  const frontendOrigins = (process.env.FRONTEND_URL ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: frontendOrigins,
    credentials: true,
  });
  
  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();
