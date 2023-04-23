import Multer from "multer";
import { google } from "googleapis";
import { OrderRow } from "../types/types";
// adapted from https://www.mohammadfaisal.dev/blog/google-drive-nodejs-react
const credentials = {
    type: process.env.type,
    project_id: process.env.project_id,
    private_key_id: process.env.private_key_id,
    private_key: process.env.private_key!.replace(/\\n/g, "\n"),
    client_email: process.env.client_email,
    client_id: process.env.client_id,
    auth_uri: process.env.auth_uri,
    token_uri: process.env.token_uri,
    auth_provider_x509_cert_url: process.env.auth_provider_x509_cert_url,
    client_x509_cert_url: process.env.client_x509_cert_url,
};

export const multer = Multer({
    storage: Multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024,
    },
});

export const authenticateGoogle = () => {
    const auth = new google.auth.GoogleAuth({
        credentials: credentials,
        scopes: "https://www.googleapis.com/auth/drive",
    });
    return auth;
};
//adapted from https://gist.github.com/iaincollins/43302ea047d4a77e6605350598d160c1
export const appendToSpreadSheet = (toAppend: any[][]) => {
    const auth = authenticateGoogle();
    const sheets = google.sheets("v4");
    sheets.spreadsheets.values.append(
        {
            spreadsheetId: process.env.ORDER_SPREADSHEET_ID,
            range: "Website Orders",
            valueInputOption: "RAW",
            insertDataOption: "INSERT_ROWS",
            resource: {
                values: toAppend,
            },
            auth: auth,
        },
        (err, response) => {
            if (err) return console.error(err);
        }
    );
};
