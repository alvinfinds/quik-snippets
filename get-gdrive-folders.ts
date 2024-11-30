import { google } from 'googleapis';
import * as fs from 'fs';
import * as http from 'http';
import * as url from 'url';
import open from 'open';
import * as path from 'path';

const CREDENTIALS_PATH = 'credentials.json';
const TOKEN_PATH = 'google-token.json';
const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];
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
      await open(authUrl);
    });
  });
}

async function listFolders(auth: any) {
  try {
    const drive = google.drive({ version: 'v3', auth });
    
    const response = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.folder'",
      pageSize: 100,
      fields: 'nextPageToken, files(id, name, createdTime)',
      orderBy: 'name',
      spaces: 'drive'
    });

    const folders = response.data.files || [];
    
    if (folders.length) {
      console.log('Found folders:');
      folders.forEach(folder => {
        console.log(`- ${folder.name} (${folder.id})`);
      });
    } else {
      console.log('No folders found.');
    }

    return folders;
  } catch (error) {
    console.error('Error listing folders:', error);
    throw error;
  }
}

async function main() {
  try {
    const auth = await authorize();
    await listFolders(auth);
  } catch (error) {
    console.error('Error:', error);
  }
}

main();