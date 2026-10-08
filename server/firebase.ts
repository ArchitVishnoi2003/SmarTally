import * as admin from "firebase-admin";

let initialized = false;

export function getAdmin(): typeof admin {
  if (!initialized) {
    const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (json) {
      const serviceAccount = JSON.parse(json);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } else {
      // Local dev: GOOGLE_APPLICATION_CREDENTIALS path to service-account.json
      admin.initializeApp();
    }
    initialized = true;
  }
  return admin;
}
