import Multer from "multer";
import { google } from "googleapis";
// adapted from https://www.mohammadfaisal.dev/blog/google-drive-nodejs-react
const credentials = {
    type: process.env.type,
    project_id: process.env.project_id,
    private_key_id: process.env.private_key_id,
    private_key: process.env.private_key,
    client_email: process.env.client_email,
    client_id: process.env.client_id,
    auth_uri: process.env.auth_uri,
    token_uri: process.env.token_uri,
    auth_provider_x509_cert_url: process.env.auth_provider_x509_cert_url,
    client_x509_cert_url: process.env.client_x509_cert_url,
};
const authenticateGoogle = () => {
    const auth = new google.auth.GoogleAuth({
        credentials: credentials,
        scopes: "https://www.googleapis.com/auth/drive",
    });
    return auth;
};
