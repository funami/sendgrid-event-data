import dotenv from 'dotenv';
dotenv.config();

import {EventWebhook, EventWebhookHeader} from '@sendgrid/eventwebhook';
import type {HttpFunction} from '@google-cloud/functions-framework/build/src/functions';
const pk = process.env.SENDGRID_VERIFICATION_KEY;
if (!pk) throw new Error('Please set SENDGRID_VERIFICATION_KEY');
import {PubSub, Topic} from '@google-cloud/pubsub';
import {Request} from '@google-cloud/functions-framework';
const pubSubClient = new PubSub();
export const SENDGRID_MAIL_EVENT_PUB =
  process.env.SENDGRID_MAIL_EVENT_PUB || 'sendgrid_mail_event_pub';

const pubData = async (data: Buffer): Promise<string | null> => {
  try {
    const topic: Topic = pubSubClient.topic(SENDGRID_MAIL_EVENT_PUB);

    const messageId = await topic.publishMessage({data});
    console.log(`messageId:${messageId} published`);
    return messageId;
  } catch (e) {
    if (e && (e as Error).message)
      console.error(`Received error while publishing: ${(e as Error).message}`);
    else console.error(`Received error while publishing, ${e}`);
  }
  return null;
};
const debugData = (req: Request) => {
  return JSON.stringify({
    headers: req.headers,
    rawBody: req.rawBody?.toString(),
  });
};
export const sendGridWebhook: HttpFunction = async (
  req,
  res
): Promise<string | null> => {
  const eh = new EventWebhook();
  try {
    const signature = req.header(EventWebhookHeader.SIGNATURE());
    const timestamp = req.header(EventWebhookHeader.TIMESTAMP());
    if (!signature || !timestamp || !req.rawBody) {
      throw new Error(
        `signature:${signature} & timestamp:${timestamp} & rawBody:${req.rawBody} can not be blank`
      );
    }
    let verifyResult;
    try {
      verifyResult = eh.verifySignature(
        eh.convertPublicKeyToECDSA(pk),
        req.rawBody,
        signature,
        timestamp
      );
    } catch (e) {
      console.error(e, debugData(req));
    }
    if (verifyResult) {
      const messgaeId = await pubData(req.rawBody)
        .then(messgaeId => {
          res.send('OK');
          return messgaeId;
        })
        .catch(e => {
          console.error(e, debugData(req));
          res.status(500).send('');
          return null;
        });
      return messgaeId;
    } else {
      console.error('verifyResult is false', debugData(req));
      res.status(401).json({
        msg: 'Unauthorized',
      });
    }
  } catch (e) {
    console.debug(e, debugData(req));
    res.status(401).send('Unauthorized');
  }
  return null;
};
