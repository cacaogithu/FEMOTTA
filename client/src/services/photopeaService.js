let photopeaFrame = null;
let photopeaReady = false;
let messageQueue = [];
let isProcessing = false;

export function initPhotopea() {
  if (photopeaFrame) return Promise.resolve();
  
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.id = 'photopea-frame';
    iframe.src = 'https://www.photopea.com';
    iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:1024px;height:768px;border:none;opacity:0;pointer-events:none;';
    document.body.appendChild(iframe);
    photopeaFrame = iframe;
    
    const readyHandler = (event) => {
      if (event.source === iframe.contentWindow && event.data === 'done') {
        photopeaReady = true;
        window.removeEventListener('message', readyHandler);
        console.log('[Photopea] Ready');
        resolve();
      }
    };
    
    window.addEventListener('message', readyHandler);
    
    iframe.onload = () => {
      console.log('[Photopea] Iframe loaded, waiting for ready signal');
      setTimeout(() => {
        if (!photopeaReady) {
          photopeaReady = true;
          window.removeEventListener('message', readyHandler);
          console.log('[Photopea] Assuming ready after timeout');
          resolve();
        }
      }, 3000);
    };
  });
}

function runScript(script) {
  if (!photopeaFrame) {
    console.error('[Photopea] Not initialized');
    return;
  }
  photopeaFrame.contentWindow.postMessage(script, 'https://www.photopea.com');
}

async function fetchImageAsDataUrl(imageUrl) {
  try {
    const token = localStorage.getItem('authToken') || localStorage.getItem('brandToken');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    
    const response = await fetch(imageUrl, { headers });
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
    
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('[Photopea] Failed to fetch image as data URL:', error);
    throw error;
  }
}

function waitForPsdData(timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      window.removeEventListener('message', handler);
      reject(new Error('Photopea timeout - no response received'));
    }, timeoutMs);
    
    const handler = (event) => {
      if (event.source !== photopeaFrame?.contentWindow) return;
      
      if (event.data instanceof ArrayBuffer) {
        clearTimeout(timeout);
        window.removeEventListener('message', handler);
        resolve(event.data);
      } else if (typeof event.data === 'string') {
        if (event.data.startsWith('error:')) {
          clearTimeout(timeout);
          window.removeEventListener('message', handler);
          reject(new Error(event.data.substring(6)));
        }
      }
    };
    
    window.addEventListener('message', handler);
  });
}

export async function generateLayeredPSD(editedImageDataUrl, spec, options = {}) {
  await initPhotopea();
  
  if (isProcessing) {
    await new Promise(resolve => messageQueue.push(resolve));
  }
  isProcessing = true;
  
  try {
    const {
      title = spec?.title || '',
      subtitle = spec?.subtitle || '',
      width = 1024,
      height = 1024
    } = options;
    
    console.log('[Photopea] Generating PSD for:', title || 'image');
    
    const cleanTitle = (title || '').replace(/"/g, '\\"').replace(/\n/g, ' ').trim();
    const cleanSubtitle = (subtitle || '').replace(/"/g, '\\"').replace(/\n/g, ' ').replace(/\(Logo\)/gi, '').trim();
    
    const script = `
      (async function() {
        try {
          // Open the image from data URL
          await app.open("${editedImageDataUrl}");
          var doc = app.activeDocument;
          doc.resizeCanvas(doc.width, doc.height);
          
          // Rename the layer
          if (doc.artLayers.length > 0) {
            doc.artLayers[0].name = "Background Image";
          }
          
          ${cleanTitle ? `
          // Add title text layer
          try {
            var titleLayer = doc.artLayers.add();
            titleLayer.kind = LayerKind.TEXT;
            titleLayer.name = "Title";
            titleLayer.textItem.contents = "${cleanTitle}";
            titleLayer.textItem.size = 48;
            titleLayer.textItem.position = [40, 80];
          } catch(e) {
            console.log("Title layer error: " + e.message);
          }
          ` : ''}
          
          ${cleanSubtitle ? `
          // Add subtitle text layer
          try {
            var subtitleLayer = doc.artLayers.add();
            subtitleLayer.kind = LayerKind.TEXT;
            subtitleLayer.name = "Subtitle";
            subtitleLayer.textItem.contents = "${cleanSubtitle}";
            subtitleLayer.textItem.size = 24;
            subtitleLayer.textItem.position = [40, 140];
          } catch(e) {
            console.log("Subtitle layer error: " + e.message);
          }
          ` : ''}
          
          // Export as PSD
          app.activeDocument.saveToOE("psd");
          
        } catch(e) {
          app.echoToOE("error:" + e.message);
        }
      })();
    `;
    
    runScript(script);
    
    const result = await waitForPsdData(60000);
    
    console.log('[Photopea] PSD generated successfully, size:', result.byteLength);
    return result;
    
  } finally {
    isProcessing = false;
    if (messageQueue.length > 0) {
      const next = messageQueue.shift();
      next();
    }
  }
}

export function downloadPSD(arrayBuffer, filename) {
  const blob = new Blob([arrayBuffer], { type: 'application/vnd.adobe.photoshop' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.psd') ? filename : `${filename}.psd`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function generateAndDownloadPSD(imageUrl, spec, filename) {
  try {
    console.log('[Photopea] Fetching image as data URL...');
    const imageDataUrl = await fetchImageAsDataUrl(imageUrl);
    console.log('[Photopea] Image fetched, generating PSD...');
    
    const psdData = await generateLayeredPSD(imageDataUrl, spec, {
      title: spec?.title || '',
      subtitle: spec?.subtitle || ''
    });
    
    downloadPSD(psdData, filename);
    console.log('[Photopea] Download complete');
    return true;
  } catch (error) {
    console.error('[Photopea] PSD generation failed:', error);
    throw error;
  }
}
