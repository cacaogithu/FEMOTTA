import { google } from 'googleapis';
import { Readable } from 'stream';

let connectionSettings;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-drive',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Google Drive not connected');
  }
  return accessToken;
}

export async function getUncachableGoogleDriveClient() {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.drive({ version: 'v3', auth: oauth2Client });
}

export async function uploadFileToDrive(fileBuffer, fileName, mimeType, folderId) {
  const drive = await getUncachableGoogleDriveClient();
  
  const fileMetadata = {
    name: fileName,
    parents: [folderId]
  };
  
  const stream = Readable.from(fileBuffer);
  
  const media = {
    mimeType: mimeType,
    body: stream
  };

  const response = await drive.files.create({
    requestBody: fileMetadata,
    media: media,
    fields: 'id, name, webContentLink, webViewLink'
  });

  return response.data;
}

export async function listFilesInFolder(folderId) {
  const drive = await getUncachableGoogleDriveClient();
  
  const response = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    fields: 'files(id, name, webContentLink, modifiedTime, mimeType)',
    orderBy: 'modifiedTime desc'
  });

  return response.data.files || [];
}

export async function createFolder(folderName, parentFolderId) {
  const drive = await getUncachableGoogleDriveClient();
  
  const fileMetadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
    parents: [parentFolderId]
  };

  const response = await drive.files.create({
    requestBody: fileMetadata,
    fields: 'id, name'
  });

  return response.data;
}

export async function downloadFileFromDrive(fileId) {
  try {
    const drive = await getUncachableGoogleDriveClient();
    
    const response = await drive.files.get(
      { fileId: fileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    );

    if (!response.data) {
      throw new Error(`No data returned for file ${fileId}`);
    }

    const buffer = Buffer.from(response.data);
    
    if (buffer.length < 1000) {
      console.error(`[Google Drive] Downloaded file ${fileId} is suspiciously small: ${buffer.length} bytes`);
      throw new Error(`Downloaded file is too small (${buffer.length} bytes) - likely invalid`);
    }
    
    console.log(`[Google Drive] Successfully downloaded file ${fileId}: ${buffer.length} bytes`);
    return buffer;
  } catch (error) {
    console.error(`[Google Drive] Failed to download file ${fileId}:`, error.message);
    throw error;
  }
}

export async function makeFilePublic(fileId) {
  const drive = await getUncachableGoogleDriveClient();
  
  await drive.permissions.create({
    fileId: fileId,
    requestBody: {
      role: 'reader',
      type: 'anyone'
    }
  });
}

export function getPublicImageUrl(fileId) {
  return `https://drive.google.com/uc?export=view&id=${fileId}`;
}
