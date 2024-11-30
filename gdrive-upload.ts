import { google } from 'googleapis';
import * as fs from 'fs';
import * as http from 'http';
import * as url from 'url';
import open from 'open';  // Changed import syntax

const CREDENTIALS_PATH = 'credentials.json';
const TOKEN_PATH = 'token.json';
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
const PORT = 3000;

async function authorize() {
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
  const { client_secret, client_id } = credentials.installed || credentials.web;
  
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    `http://localhost:${PORT}/oauth2callback`
  );

  if (fs.existsSync(TOKEN_PATH)) {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
    oAuth2Client.setCredentials(token);
    return oAuth2Client;
  }

  return await getNewToken(oAuth2Client);
}

function getNewToken(oAuth2Client: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    });

    const server = http.createServer(async (req, res) => {
      try {
        const queryParams = url.parse(req.url!, true).query;
        if (queryParams.code) {
          res.end('Authentication successful! You can close this window.');
          server.close();

          const { tokens } = await oAuth2Client.getToken(queryParams.code);
          oAuth2Client.setCredentials(tokens);
          fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
          resolve(oAuth2Client);
        }
      } catch (err) {
        reject(err);
      }
    });

    server.listen(PORT, async () => {
      console.log(`Authorization server listening on port ${PORT}`);
      await open(authUrl);  // Using await with open
    });
  });
}

async function uploadFile(auth: any) {
  try {
    const drive = google.drive({ version: 'v3', auth });
    const fileMetadata = {
      name: 'testfile.txt',
    };
    const media = {
      mimeType: 'text/plain',
      body: fs.createReadStream('testfile.txt'),
    };
    
    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id',
    });
    
    console.log('File uploaded successfully. File ID:', response.data.id);
    return response.data.id;
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
}

async function main() {
  try {
    const auth = await authorize();
    await uploadFile(auth);
  } catch (error) {
    console.error('Error:', error);
  }
}

main();