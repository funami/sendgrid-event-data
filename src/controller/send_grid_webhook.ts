import dotenv from 'dotenv';
dotenv.config();

import {EventWebhook, EventWebhookHeader} from '@sendgrid/eventwebhook';
import type {HttpFunction} from '@google-cloud/functions-framework/build/src/functions';
const pk = process.env.SENDGRID_PUBRICKEY;
if (!pk) throw new Error('Please set SENDGRID_PUBRICKEY');

const pubData = (data: JSON): Promise<void> => {
  return Promise.resolve();
};
export const sendGridWebhook: HttpFunction = async (req, res) => {
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
      console.error(e);
    }
    if (verifyResult) {
      await pubData(req.body);
      res.send('OK');
    } else {
      res.status(401).json({
        msg: 'Unauthorized',
      });
    }
  } catch (e) {
    res.status(401).send('');
  }
};
