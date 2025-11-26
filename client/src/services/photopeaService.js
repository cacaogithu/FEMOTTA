let photopeaFrame = null;
let photopeaReady = false;
let messageQueue = [];
let isProcessing = false;
let processingTimeout = null;

function resetProcessingState() {
  console.log('[PHOTOPEA] 🔄 Resetting processing state');
  isProcessing = false;
  if (processingTimeout) {
    clearTimeout(processingTimeout);
    processingTimeout = null;
  }
  while (messageQueue.length > 0) {
    const resolve = messageQueue.shift();
    resolve();
  }
}

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
        console.log('[PHOTOPEA] ✅ Initialized and ready');
        resolve();
      }
    };
    
    window.addEventListener('message', readyHandler);
    
    iframe.onload = () => {
      console.log('[PHOTOPEA] Iframe loaded, waiting for ready signal...');
      setTimeout(() => {
        if (!photopeaReady) {
          photopeaReady = true;
          window.removeEventListener('message', readyHandler);
          console.log('[PHOTOPEA] ✅ Ready (assumed after 3s timeout)');
          resolve();
        }
      }, 3000);
    };
  });
}

function runScript(script) {
  if (!photopeaFrame) {
    console.error('[PHOTOPEA] ❌ ERROR: Not initialized');
    return;
  }
  console.log('[PHOTOPEA] 📤 Sending script to Photopea...');
  photopeaFrame.contentWindow.postMessage(script, 'https://www.photopea.com');
}

async function fetchImageAsDataUrl(imageUrl) {
  console.log('[PHOTOPEA] 🔄 Fetching image:', imageUrl.substring(0, 80) + '...');
  try {
    const token = localStorage.getItem('authToken') || localStorage.getItem('brandToken');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    
    const response = await fetch(imageUrl, { headers });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const blob = await response.blob();
    console.log('[PHOTOPEA] ✅ Image fetched:', Math.round(blob.size / 1024), 'KB');
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        console.log('[PHOTOPEA] ✅ Converted to data URL');
        resolve(reader.result);
      };
      reader.onerror = (err) => {
        console.error('[PHOTOPEA] ❌ FileReader error:', err);
        reject(err);
      };
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('[PHOTOPEA] ❌ Fetch failed:', error.message);
    throw error;
  }
}

function waitForPsdData(timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    console.log('[PHOTOPEA] ⏳ Waiting for PSD data (timeout:', timeoutMs/1000, 's)...');
    
    const timeout = setTimeout(() => {
      window.removeEventListener('message', handler);
      console.error('[PHOTOPEA] ❌ TIMEOUT: No response after', timeoutMs/1000, 'seconds');
      reject(new Error('Photopea timeout - no response received after ' + timeoutMs/1000 + 's'));
    }, timeoutMs);
    
    const handler = (event) => {
      if (event.source !== photopeaFrame?.contentWindow) return;
      
      if (event.data instanceof ArrayBuffer) {
        clearTimeout(timeout);
        window.removeEventListener('message', handler);
        console.log('[PHOTOPEA] ✅ Received PSD data:', Math.round(event.data.byteLength / 1024), 'KB');
        resolve(event.data);
      } else if (typeof event.data === 'string') {
        console.log('[PHOTOPEA] 📨 Received message:', event.data.substring(0, 100));
        if (event.data.startsWith('error:')) {
          clearTimeout(timeout);
          window.removeEventListener('message', handler);
          const errorMsg = event.data.substring(6);
          console.error('[PHOTOPEA] ❌ Script error:', errorMsg);
          reject(new Error(errorMsg));
        }
      }
    };
    
    window.addEventListener('message', handler);
  });
}

export async function generateLayeredPSD(editedImageDataUrl, spec, options = {}) {
  await initPhotopea();
  
  if (isProcessing) {
    console.log('[PHOTOPEA] ⏳ Queued - waiting for previous operation (max 30s)...');
    const waitPromise = new Promise(resolve => messageQueue.push(resolve));
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Queue timeout - previous operation took too long')), 30000)
    );
    try {
      await Promise.race([waitPromise, timeoutPromise]);
    } catch (e) {
      console.warn('[PHOTOPEA] ⚠️ Queue timeout, resetting state');
      resetProcessingState();
    }
  }
  isProcessing = true;
  
  processingTimeout = setTimeout(() => {
    console.error('[PHOTOPEA] ⚠️ Processing timeout (90s), forcing reset');
    resetProcessingState();
  }, 90000);
  
  try {
    const {
      title = spec?.title || '',
      subtitle = spec?.subtitle || ''
    } = options;
    
    console.log('[PHOTOPEA] 🎨 GENERATING LAYERED PSD');
    console.log('[PHOTOPEA] → Title:', title || '(none)');
    console.log('[PHOTOPEA] → Subtitle:', subtitle || '(none)');
    console.log('[PHOTOPEA] → Image size:', Math.round(editedImageDataUrl.length / 1024), 'KB base64');
    
    const cleanTitle = (title || '').replace(/"/g, '\\"').replace(/\n/g, ' ').trim();
    const cleanSubtitle = (subtitle || '').replace(/"/g, '\\"').replace(/\n/g, ' ').replace(/\(Logo\)/gi, '').trim();
    
    const script = `
      (async function() {
        try {
          console.log("Photopea: Opening image...");
          await app.open("${editedImageDataUrl}");
          var doc = app.activeDocument;
          console.log("Photopea: Document opened, size:", doc.width, "x", doc.height);
          
          if (doc.artLayers.length > 0) {
            doc.artLayers[0].name = "Background Image";
          }
          
          ${cleanTitle ? `
          try {
            console.log("Photopea: Adding title layer...");
            var titleLayer = doc.artLayers.add();
            titleLayer.kind = LayerKind.TEXT;
            titleLayer.name = "Title";
            titleLayer.textItem.contents = "${cleanTitle}";
            titleLayer.textItem.size = 48;
            titleLayer.textItem.position = [40, 80];
            titleLayer.textItem.color = new SolidColor();
            titleLayer.textItem.color.rgb.red = 255;
            titleLayer.textItem.color.rgb.green = 255;
            titleLayer.textItem.color.rgb.blue = 255;
            console.log("Photopea: Title layer added");
          } catch(e) {
            console.log("Photopea: Title error:", e.message);
            app.echoToOE("error:Title layer failed: " + e.message);
            return;
          }
          ` : ''}
          
          ${cleanSubtitle ? `
          try {
            console.log("Photopea: Adding subtitle layer...");
            var subtitleLayer = doc.artLayers.add();
            subtitleLayer.kind = LayerKind.TEXT;
            subtitleLayer.name = "Subtitle";
            subtitleLayer.textItem.contents = "${cleanSubtitle}";
            subtitleLayer.textItem.size = 24;
            subtitleLayer.textItem.position = [40, 140];
            subtitleLayer.textItem.color = new SolidColor();
            subtitleLayer.textItem.color.rgb.red = 255;
            subtitleLayer.textItem.color.rgb.green = 255;
            subtitleLayer.textItem.color.rgb.blue = 255;
            console.log("Photopea: Subtitle layer added");
          } catch(e) {
            console.log("Photopea: Subtitle error:", e.message);
            app.echoToOE("error:Subtitle layer failed: " + e.message);
            return;
          }
          ` : ''}
          
          console.log("Photopea: Exporting PSD...");
          app.activeDocument.saveToOE("psd");
          console.log("Photopea: Export complete");
          
        } catch(e) {
          console.log("Photopea: Main error:", e.message);
          app.echoToOE("error:" + e.message);
        }
      })();
    `;
    
    runScript(script);
    
    const result = await waitForPsdData(60000);
    
    console.log('[PHOTOPEA] ✅ PSD GENERATED SUCCESSFULLY');
    console.log('[PHOTOPEA] → File size:', Math.round(result.byteLength / 1024), 'KB');
    console.log('[PHOTOPEA] → Layers: Background Image' + (cleanTitle ? ', Title' : '') + (cleanSubtitle ? ', Subtitle' : ''));
    
    return result;
    
  } catch (error) {
    console.error('[PHOTOPEA] ❌ PSD GENERATION FAILED');
    console.error('[PHOTOPEA] → Error:', error.message || error.toString());
    console.error('[PHOTOPEA] → Stack:', error.stack);
    throw error;
  } finally {
    if (processingTimeout) {
      clearTimeout(processingTimeout);
      processingTimeout = null;
    }
    isProcessing = false;
    if (messageQueue.length > 0) {
      const next = messageQueue.shift();
      next();
    }
  }
}

export function downloadPSD(arrayBuffer, filename) {
  console.log('[PHOTOPEA] 📥 Downloading PSD:', filename);
  const blob = new Blob([arrayBuffer], { type: 'application/vnd.adobe.photoshop' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.psd') ? filename : `${filename}.psd`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  console.log('[PHOTOPEA] ✅ Download triggered');
}

export async function generateAndDownloadPSD(imageUrl, spec, filename) {
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('[PHOTOPEA] 🚀 STARTING PSD GENERATION');
  console.log('═══════════════════════════════════════════════════════');
  console.log('[PHOTOPEA] Filename:', filename);
  console.log('[PHOTOPEA] Title:', spec?.title || '(none)');
  console.log('[PHOTOPEA] Subtitle:', spec?.subtitle || '(none)');
  console.log('[PHOTOPEA] Image URL:', imageUrl.substring(0, 100) + '...');
  
  try {
    const imageDataUrl = await fetchImageAsDataUrl(imageUrl);
    
    const psdData = await generateLayeredPSD(imageDataUrl, spec, {
      title: spec?.title || '',
      subtitle: spec?.subtitle || ''
    });
    
    downloadPSD(psdData, filename);
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('[PHOTOPEA] ✅ PSD COMPLETE:', filename);
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
    
    return true;
  } catch (error) {
    console.log('═══════════════════════════════════════════════════════');
    console.error('[PHOTOPEA] ❌ PSD FAILED:', error.message || 'Unknown error');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
    throw error;
  }
}
