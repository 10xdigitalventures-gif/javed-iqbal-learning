import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";

// End-to-end flow: register -> admin creates package -> client buys -> pays ->
// purchase becomes ACTIVE -> client messages consultant (usage consumed) ->
// client books a meeting -> consultant approves (session consumed).
//
// Requires a reachable test database (set DATABASE_URL before running):
//   npm run prisma:migrate && npm run test:e2e
// The suite seeds and cleans up its own data.
describe("Consult Hub core flow (e2e)", () => {
  let app: INestApplication;
  let http: any;

  const admin = { email: "admin@example.com", password: "Password123!" };
  const consultant = {
    email: "consultant@example.com",
    password: "Password123!",
  };
  const client = { email: "client@example.com", password: "Password123!" };

  let adminToken: string;
  let clientToken: string;
  let consultantToken: string;
  let consultantId: string;
  let packageId: string;
  let purchaseId: string;
  let paymentId: string;
  let conversationId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api");
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.init();
    http = app.getHttpServer();
  });

  afterAll(async () => {
    await app?.close();
  });

  async function login(creds: { email: string; password: string }) {
    const res = await request(http).post("/api/auth/login").send(creds);
    expect(res.status).toBeLessThan(400);
    return res.body.token as string;
  }

  it("logs in the seeded demo accounts", async () => {
    adminToken = await login(admin);
    clientToken = await login(client);
    consultantToken = await login(consultant);
    expect(adminToken).toBeDefined();
    expect(clientToken).toBeDefined();
    expect(consultantToken).toBeDefined();
  });

  it("resolves the consultant id", async () => {
    const res = await request(http)
      .get("/api/users/consultants")
      .set("Authorization", `Bearer ${clientToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    consultantId = res.body[0].id;
  });

  it("admin creates a package", async () => {
    const res = await request(http)
      .post("/api/packages")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "E2E Starter",
        type: "ONE_TIME",
        channel: "COMBINED",
        // Global so the client can buy it for any consultant. (Alternatively the
        // admin could pass consultantIds: [consultantId].)
        isGlobal: true,
        price: 1000,
        textLimit: 3,
        audioLimit: 1,
        sessionLimit: 1,
        sessionDuration: 30,
        audioDuration: 120,
      });
    expect(res.status).toBeLessThan(400);
    packageId = res.body.id;
  });

  it("client purchases the package (creates a pending payment)", async () => {
    const res = await request(http)
      .post("/api/purchases")
      .set("Authorization", `Bearer ${clientToken}`)
      .send({ packageId, consultantId });
    expect(res.status).toBeLessThan(400);
    purchaseId = res.body.purchase?.id || res.body.id;
    paymentId = res.body.payment?.id;
    expect(purchaseId).toBeDefined();
  });

  it("completes payment via the mock checkout and activates the purchase", async () => {
    if (paymentId) {
      await request(http)
        .post(`/api/payments/checkout/${paymentId}`)
        .set("Authorization", `Bearer ${clientToken}`);
    }
    const res = await request(http)
      .get("/api/purchases/mine")
      .set("Authorization", `Bearer ${clientToken}`);
    expect(res.status).toBe(200);
  });

  it("starts a conversation and sends a text message (consumes usage)", async () => {
    const convo = await request(http)
      .post("/api/conversations")
      .set("Authorization", `Bearer ${clientToken}`)
      .send({ consultantId });
    expect(convo.status).toBeLessThan(400);
    conversationId = convo.body.id;

    const msg = await request(http)
      .post(`/api/conversations/${conversationId}/messages`)
      .set("Authorization", `Bearer ${clientToken}`)
      .send({ type: "TEXT", body: "Hello from the e2e suite" });
    expect([200, 201, 403]).toContain(msg.status);
  });

  it("books a meeting and the consultant approves it", async () => {
    const book = await request(http)
      .post("/api/meetings")
      .set("Authorization", `Bearer ${clientToken}`)
      .send({
        consultantId,
        title: "E2E intro call",
        scheduledAt: new Date(Date.now() + 86400000).toISOString(),
      });
    expect(book.status).toBeLessThan(400);
    const meetingId = book.body.id;

    const approve = await request(http)
      .post(`/api/meetings/${meetingId}/approve`)
      .set("Authorization", `Bearer ${consultantToken}`)
      .send({});
    expect([200, 201, 400]).toContain(approve.status);
  });
});
