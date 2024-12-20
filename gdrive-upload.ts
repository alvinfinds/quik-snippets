import { google } from 'googleapis';
import * as fs from 'fs';
import * as http from 'http';
import * as url from 'url';
import open from 'open';  // Changed import syntax
import * as path from 'path';

const CREDENTIALS_PATH = 'credentials.json';
const TOKEN_PATH = 'google-token.json';
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

async function findFile(drive: any, fileName: string, folderId?: string) {
    try {
      let query = `name = '${fileName}' and trashed = false`;
      if (folderId) {
        query += ` and '${folderId}' in parents`;
      }
  
      const response = await drive.files.list({
        q: query,
        fields: 'files(id, name)',
        spaces: 'drive',
      });
  
      return response.data.files[0];
    } catch (error) {
      console.error('Error searching for file:', error);
      return null;
    }
  }
  
  async function uploadFile(auth: any, filePath: string, fileName?: string, folderId?: string) {
    try {
      const drive = google.drive({ version: 'v3', auth });
      const finalFileName = fileName || path.basename(filePath);
      
      // Check if file exists
      const existingFile = await findFile(drive, finalFileName, folderId);
      
      const media = {
        mimeType: 'text/plain',
        body: fs.createReadStream(filePath),
      };
  
      let response;
      if (existingFile) {
        // Update existing file
        const updateRequest: any = {
          fileId: existingFile.id,
          media: media,
          fields: 'id, webViewLink',
        };
  
        // Handle folder changes if needed
        if (folderId) {
          const currentParents = (await drive.files.get({
            fileId: existingFile.id,
            fields: 'parents'
          })).data.parents;
  
          updateRequest.addParents = folderId;
          if (currentParents) {
            updateRequest.removeParents = currentParents.join(',');
          }
        }
  
        response = await drive.files.update(updateRequest);
        console.log('File updated successfully.');
      } else {
        // Create new file
        const fileMetadata: any = {
          name: finalFileName,
        };
        if (folderId) {
          fileMetadata.parents = [folderId];
        }
  
        response = await drive.files.create({
          requestBody: fileMetadata,
          media: media,
          fields: 'id, webViewLink',
        });
        console.log('File uploaded successfully.');
      }
  
      console.log('File ID:', response.data.id);
      console.log('Web View Link:', response.data.webViewLink);
      return response.data;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  }
  
  // Example usage in main function
  async function main() {
    try {
      const auth = await authorize();
      
      // Upload to root folder
      // await uploadFile(auth, 'testfile.txt', 'testfile.txt', "root");
      
      // Upload to specific folder
      await uploadFile(auth, 'testfile.txt', 'testfile.txt', '1CfxzDUJIh9wLR4cz9pFiPUavFNiubJ07');
    } catch (error) {
      console.error('Error:', error);
    }
  }
  
  main();