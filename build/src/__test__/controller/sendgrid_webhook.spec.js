"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint @typescript-eslint/no-explicit-any: 0 */
process.env.SENDGRID_VERIFICATION_KEY =
    'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEisUZKmTvAcMnqf1cenjsvVm72Oo28ExFpGMvzxC+10BQcn5mhCctHmG1mmBoWmn3BRVsuLCyShvJsPGJFQ5Kag==';
const sendgrid_webhook_1 = require("../../controller/sendgrid_webhook");
const pubsub_1 = require("@google-cloud/pubsub");
const pubSubClient = new pubsub_1.PubSub();
const fs_extra_1 = __importDefault(require("fs-extra"));
class MockRequest {
    constructor(headers, rawBody) {
        this.headers = headers;
        this.rawBody = rawBody;
        this.header = (name) => {
            return this.headers[name.toLowerCase()];
        };
    }
    get body() {
        return this.rawBody.toString();
    }
}
const mockRes = {
    send: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
};
if (!process.env.PUBSUB_EMULATOR_HOST) {
    throw '!!!PLEASE USE pub/sub emulator for test!!!';
}
beforeAll(async () => {
    try {
        await pubSubClient.createTopic(sendgrid_webhook_1.SENDGRID_MAIL_EVENT_PUB);
    }
    catch (e) {
        //console.error(e);
    }
});
beforeEach(() => {
    Object.keys(mockRes).forEach(key => {
        mockRes[key].mockClear();
    });
});
describe('sendGridWebhook', () => {
    test('varid request', async () => {
        const rawBody = fs_extra_1.default.readFileSync(`${__dirname}/rawBody.txt`);
        const mockReq = new MockRequest({
            host: 'faa5-122-210-52-193.jp.ngrok.io',
            'user-agent': 'SendGrid Event API',
            'content-length': '3741',
            'accept-encoding': 'gzip',
            'content-type': 'application/json',
            'x-forwarded-for': '18.190.12.217',
            'x-forwarded-proto': 'https',
            'x-twilio-email-event-webhook-signature': 'MEYCIQCHMAoGvI6oszb5KHvNukigtFgWCDQdkIGgLA1CHrLyRQIhAIKF44uJlWzR6Dr6Xv6KpLI9TtFUm8JbzOr4zqcUZQ50',
            'x-twilio-email-event-webhook-timestamp': '1660894947',
        }, rawBody);
        await expect((0, sendgrid_webhook_1.sendGridWebhook)(mockReq, mockRes)).resolves.toMatch(/\d+/);
        expect(mockRes.json).not.toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
        expect(mockRes.send).toHaveBeenCalledWith('OK');
    });
    test('invarid request x-twilio-email-event-webhook-signature 不正', async () => {
        const rawBody = fs_extra_1.default.readFileSync(`${__dirname}/rawBody.txt`);
        const mockReq = new MockRequest({
            host: 'faa5-122-210-52-193.jp.ngrok.io',
            'user-agent': 'SendGrid Event API',
            'content-length': '3741',
            'accept-encoding': 'gzip',
            'content-type': 'application/json',
            'x-forwarded-for': '18.190.12.217',
            'x-forwarded-proto': 'https',
            'x-twilio-email-event-webhook-signature': 'NG',
            'x-twilio-email-event-webhook-timestamp': '1660623877',
        }, rawBody);
        await expect((0, sendgrid_webhook_1.sendGridWebhook)(mockReq, mockRes)).resolves.toBeNull();
        expect(mockRes.json).toHaveBeenCalledWith({
            msg: 'Unauthorized',
        });
        expect(mockRes.send).not.toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(401);
    });
    test('invarid request x-twilio-email-event-webhook headerなし', async () => {
        const rawBody = fs_extra_1.default.readFileSync(`${__dirname}/rawBody.txt`);
        const mockReq = new MockRequest({
            host: 'faa5-122-210-52-193.jp.ngrok.io',
            'user-agent': 'SendGrid Event API',
            'content-length': '3741',
            'accept-encoding': 'gzip',
            'content-type': 'application/json',
            'x-forwarded-for': '18.190.12.217',
            'x-forwarded-proto': 'https',
        }, rawBody);
        await expect((0, sendgrid_webhook_1.sendGridWebhook)(mockReq, mockRes)).resolves.toBeNull();
        expect(mockRes.json).not.toHaveBeenCalled();
        expect(mockRes.send).toHaveBeenCalledWith('Unauthorized');
        expect(mockRes.status).toHaveBeenCalledWith(401);
    });
});
//# sourceMappingURL=sendgrid_webhook.spec.js.map