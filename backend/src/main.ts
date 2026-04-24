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
  
  app.enableCors({
    origin: '*',
    credentials: true,
  });
  
  await app.listen(3000);
  console.log(`Application is running on: http://localhost:3000`);
}
bootstrap();