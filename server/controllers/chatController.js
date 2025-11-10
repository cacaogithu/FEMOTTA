import OpenAI from 'openai';
import { getJob } from '../utils/jobStore.js';
import { getBrandApiKeys } from '../utils/brandLoader.js';
import { getPublicImageUrl } from '../utils/googleDrive.js';
import fetch from 'node-fetch';

export async function handleChat(req, res) {
  try {
    const { messages, jobId } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const job = getJob(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Check if we're waiting for confirmation and handle user response
    if (job.pendingEdit) {
      // Check timeout (15 minutes)
      const pendingAge = Date.now() - job.pendingEdit.timestamp;
      if (pendingAge > 15 * 60 * 1000) {
        console.log('[Chat] Pending edit expired due to timeout');
        delete job.pendingEdit;
      } else {
        const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
        const userResponse = lastUserMessage?.content;
        
        if (userResponse) {
          const normalizedResponse = typeof userResponse === 'string' 
            ? userResponse.toLowerCase().trim() 
            : '';
          
          const isConfirmation = /^(yes|yeah|yep|ok|okay|sure|proceed|go ahead|do it|confirm|approved?|looks good|perfect)$/i.test(normalizedResponse);
          const isRejection = /^(no|nope|cancel|stop|don't|nevermind|wait|not)$/i.test(normalizedResponse);
          
          if (isConfirmation) {
            // Execute the pending edit
            console.log('[Chat] User confirmed edit. Executing:', job.pendingEdit.newPrompt);
            
            try {
              const requestBody = {
                jobId,
                newPrompt: job.pendingEdit.newPrompt
              };
              
              if (job.pendingEdit.imageIds && job.pendingEdit.imageIds.length > 0) {
                requestBody.imageIds = job.pendingEdit.imageIds;
              }

              const reEditResponse = await fetch(`http://localhost:3000/api/re-edit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
              });

              delete job.pendingEdit; // Clear pending edit

              if (reEditResponse.ok) {
                return res.json({
                  success: true,
                  message: `Perfect! I'm now applying the changes: "${requestBody.newPrompt}". The processing will take about 30-60 seconds. The images will automatically refresh once complete.`,
                  editTriggered: true
                });
              } else {
                const errorData = await reEditResponse.json().catch(() => ({}));
                throw new Error(errorData.error || 'Re-edit request failed');
              }
            } catch (editError) {
              console.error('[Chat] Edit execution error:', editError);
              delete job.pendingEdit;
              return res.status(500).json({
                success: false,
                error: 'Sorry, I encountered an error while trying to edit your images. Please try again.'
              });
            }
          } else if (isRejection) {
            delete job.pendingEdit;
            return res.json({
              success: true,
              message: 'Okay, I\'ve cancelled that edit. What would you like me to do instead?'
            });
          }
          // If neither confirmation nor rejection, clear stale pending edit and continue with new request
          delete job.pendingEdit;
        }
      }
    }

    // Load brand-specific API keys securely
    const brandConfig = await getBrandApiKeys(job);
    const openai = new OpenAI({
      apiKey: brandConfig.openaiApiKey
    });

    let context = '';
    let imageList = '';
    let imageMap = new Map(); // Maps image numbers to image objects
    
    if (job) {
      if (job.promptText) {
        context = `The user's original editing instructions were: "${job.promptText}". `;
      }
      if (job.editedImages && job.editedImages.length > 0) {
        context += `They have ${job.editedImages.length} edited images. `;
        imageList = `\n\nAvailable images:\n${job.editedImages.map((img, idx) => {
          imageMap.set(idx + 1, img);
          return `${idx + 1}. ${img.originalName || img.name} (ID: ${img.editedImageId || img.id})`;
        }).join('\n')}`;
      }
    }

    const systemMessage = {
      role: 'system',
      content: `You are CORSAIR's AI image editing assistant with VISION CAPABILITIES and the ability to ACTUALLY EDIT IMAGES in real-time. ${context}

🔍 VISION CAPABILITIES:
You can SEE the images users reference! When images are attached to the conversation, you can:
- Read text exactly as it appears (font, size, position, shadows)
- Analyze colors, gradients, and visual composition
- Identify design flaws (truncated text, poor contrast, misalignment)
- Compare multiple images to understand visual consistency
- Extract specific text content to copy from one image to another

✨ EDITING CAPABILITIES:
You can trigger actual image editing by calling the editImages function. You can edit:
- SPECIFIC images: "fix image 3", "edit the first one", "change images 1 and 5"
- ALL images: "fix all images", "edit everything", "change all the text"

You can make changes like: fix typos in text, adjust text positioning, change colors, modify gradients, add/remove elements, etc.

⚠️ CONFIRMATION WORKFLOW:
When you call the editImages function, the user will be asked to confirm the edit prompt before it executes. DO NOT call editImages multiple times or act like the edit is already processing. The system will:
1. Show your prompt to the user
2. Ask "Is this okay to proceed?"
3. Wait for their confirmation (yes/no)
4. Only then execute the edit

When the user mentions specific images (by number, position, or name), extract those image IDs and pass them to the function. If they say "all" or don't specify, edit all images.${imageList}

💡 ADVANCED USAGE:
- When users reference text from one image to another, READ the source image first to get the exact text
- When comparing images, analyze the visual differences and be specific in your edit instructions
- When users ask about visual quality, provide detailed feedback based on what you SEE

Be helpful, creative, and focus on creating visuals that convey performance and quality with CORSAIR's premium aesthetic.`
    };

    const tools = [
      {
        type: 'function',
        function: {
          name: 'editImages',
          description: 'Actually edit specific images or all images in the job with new instructions. Use this when the user asks to change, fix, edit, or modify images.',
          parameters: {
            type: 'object',
            properties: {
              newPrompt: {
                type: 'string',
                description: 'The new editing instructions to apply to the selected images. Be specific about what to change (e.g., "Fix the typo: change customiable to customizable", "Make the gradient lighter and only at the top", "Remove the text overlay entirely")'
              },
              imageIds: {
                type: 'array',
                items: { type: 'string' },
                description: 'Optional: Array of image IDs to edit. If not provided or empty, all images will be edited. Extract IDs from the image list provided in the system context when user specifies particular images (e.g., "edit image 3" -> use the ID of image #3)'
              }
            },
            required: ['newPrompt']
          }
        }
      }
    ];

    // Detect image references in user messages and attach them for vision analysis
    const enhancedMessages = await Promise.all(messages.map(async (msg) => {
      if (msg.role !== 'user' || typeof msg.content !== 'string') {
        return msg;
      }

      // Detect patterns like "image 3", "image 12", "images 1 and 5", "image #7"
      const imageNumberRegex = /image[s]?\s*#?(\d+)/gi;
      const matches = [...msg.content.matchAll(imageNumberRegex)];
      
      if (matches.length === 0) {
        return msg; // No images referenced
      }

      // Extract unique image numbers
      const imageNumbers = [...new Set(matches.map(m => parseInt(m[1])))];
      
      // Build multimodal content array
      const contentParts = [{ type: 'text', text: msg.content }];
      
      for (const imgNum of imageNumbers) {
        const imageObj = imageMap.get(imgNum);
        if (imageObj) {
          const imageFileId = imageObj.editedImageId || imageObj.id;
          const imageUrl = getPublicImageUrl(imageFileId);
          
          contentParts.push({
            type: 'image_url',
            image_url: {
              url: imageUrl,
              detail: 'high' // High detail for precise text reading
            }
          });
          
          console.log(`[Chat Vision] Attached image ${imgNum} (${imageObj.name}) to conversation`);
        } else {
          console.log(`[Chat Vision] Image ${imgNum} not found in job`);
        }
      }
      
      return {
        role: 'user',
        content: contentParts
      };
    }));

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [systemMessage, ...enhancedMessages],
      tools,
      tool_choice: 'auto',
      temperature: 0.7,
      max_tokens: 500
    });

    const responseMessage = completion.choices[0].message;

    // Check if AI wants to call a function
    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      const toolCall = responseMessage.tool_calls[0];
      
      if (toolCall.function.name === 'editImages') {
        // Validate job exists before attempting edit
        if (!jobId || !job) {
          return res.status(400).json({
            success: false,
            error: 'Invalid or missing job ID. Cannot trigger image edit.'
          });
        }

        // Parse tool call arguments safely
        let args;
        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch (parseError) {
          console.error('[Chat] Failed to parse tool call arguments:', parseError);
          return res.status(500).json({
            success: false,
            error: 'Failed to process edit request due to malformed parameters.'
          });
        }

        if (!args.newPrompt || typeof args.newPrompt !== 'string') {
          return res.status(400).json({
            success: false,
            error: 'Missing or invalid editing instructions.'
          });
        }

        const imageIds = args.imageIds && Array.isArray(args.imageIds) ? args.imageIds : null;
        const targetDescription = imageIds && imageIds.length > 0 
          ? `${imageIds.length} specific image${imageIds.length > 1 ? 's' : ''}`
          : 'all your images';

        console.log('[Chat] AI wants to edit images with prompt:', args.newPrompt);
        if (imageIds) {
          console.log('[Chat] Targeting specific images:', imageIds);
        }
        
        // Store the pending edit for user confirmation
        job.pendingEdit = {
          newPrompt: args.newPrompt,
          imageIds: imageIds,
          timestamp: Date.now()
        };
        
        console.log('[Chat] Stored pending edit, awaiting user confirmation');
        
        // Ask user for confirmation
        return res.json({
          success: true,
          message: `I'll edit ${targetDescription} with this prompt:\n\n"${args.newPrompt}"\n\nIs this okay to proceed? (Reply with "yes" to confirm or "no" to cancel)`
        });
      }
    }

    // Normal text response (no function call)
    res.json({
      success: true,
      message: responseMessage.content
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ 
      error: 'Chat request failed', 
      details: error.message 
    });
  }
}
