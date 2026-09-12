import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/api/v1/geo/countries (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/geo/countries')
      .expect(200);
  });

  it('/api/v1/geo/states (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/geo/states')
      .expect(200);
  });

  it('/api/v1/parties (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/parties')
      .expect(200);
  });

  it('/api/v1/feeds (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/feeds')
      .expect(200);
  });

  it('/api/v1/docs (GET) - Swagger UI', () => {
    return request(app.getHttpServer())
      .get('/docs')
      .expect(200);
  });
});
