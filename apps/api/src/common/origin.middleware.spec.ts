import {
  Controller,
  Get,
  INestApplication,
  MiddlewareConsumer,
  Module,
  NestModule,
  Post,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { OriginMiddleware } from './origin.middleware';

@Controller('things')
class ThingsController {
  @Get()
  list(): { ok: true } {
    return { ok: true };
  }

  @Post()
  create(): { ok: true } {
    return { ok: true };
  }
}

@Module({ controllers: [ThingsController] })
class TestModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(OriginMiddleware).forRoutes('*path');
  }
}

/** Интеграционный тест: настоящее HTTP-приложение Nest с middleware проверки Origin (ТЗ п. 11). */
describe('OriginMiddleware (integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [TestModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(() => app.close());

  it('rejects a mutating request from a foreign origin', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/things')
      .set('Host', 'tsz.example')
      .set('Origin', 'https://evil.example');
    expect(response.status).toBe(403);
    expect(response.body).toEqual({ statusCode: 403, code: 'ORIGIN_MISMATCH' });
  });

  it('rejects a mutating request without Origin', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/things')
      .set('Host', 'tsz.example');
    expect(response.status).toBe(403);
  });

  it('accepts a mutating request from the same origin', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/things')
      .set('Host', 'tsz.example')
      .set('Origin', 'https://tsz.example');
    expect(response.status).toBe(201);
  });

  it('does not check safe methods', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/things')
      .set('Host', 'tsz.example')
      .set('Origin', 'https://evil.example');
    expect(response.status).toBe(200);
  });
});
