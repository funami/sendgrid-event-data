"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendGridWebhook = exports.SENDGRID_MAIL_EVENT_PUB = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const eventwebhook_1 = require("@sendgrid/eventwebhook");
const pk = process.env.SENDGRID_VERIFICATION_KEY;
if (!pk)
    throw new Error('Please set SENDGRID_VERIFICATION_KEY');
const pubsub_1 = require("@google-cloud/pubsub");
const pubSubClient = new pubsub_1.PubSub();
exports.SENDGRID_MAIL_EVENT_PUB = process.env.SENDGRID_MAIL_EVENT_PUB || 'sendgrid_mail_event_pub';
const pubData = async (data) => {
    try {
        const topic = pubSubClient.topic(exports.SENDGRID_MAIL_EVENT_PUB);
        const messageId = await topic.publishMessage({ data });
        console.log(`messageId:${messageId} published`);
        return messageId;
    }
    catch (e) {
        if (e && e.message)
            console.error(`Received error while publishing: ${e.message}`);
        else
            console.error(`Received error while publishing, ${e}`);
    }
    return null;
};
const sendGridWebhook = async (req, res) => {
    const eh = new eventwebhook_1.EventWebhook();
    try {
        const signature = req.header(eventwebhook_1.EventWebhookHeader.SIGNATURE());
        const timestamp = req.header(eventwebhook_1.EventWebhookHeader.TIMESTAMP());
        if (!signature || !timestamp || !req.rawBody) {
            throw new Error(`signature:${signature} & timestamp:${timestamp} & rawBody:${req.rawBody} can not be blank`);
        }
        let verifyResult;
        try {
            verifyResult = eh.verifySignature(eh.convertPublicKeyToECDSA(pk), req.rawBody, signature, timestamp);
        }
        catch (e) {
            console.error(e);
        }
        if (verifyResult) {
            const messgaeId = await pubData(req.rawBody)
                .then(messgaeId => {
                res.send('OK');
                return messgaeId;
            })
                .catch(e => {
                console.error(e);
                res.status(500).send('');
                return null;
            });
            return messgaeId;
        }
        else {
            res.status(401).json({
                msg: 'Unauthorized',
            });
        }
    }
    catch (e) {
        //console.error('Unauthorized 1');
        res.status(401).send('');
    }
    return null;
};
exports.sendGridWebhook = sendGridWebhook;
//# sourceMappingURL=sendgrid_webhook.js.map