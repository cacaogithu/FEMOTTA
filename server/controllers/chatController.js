import OpenAI from 'openai';
import { getJob, updateJob } from '../utils/jobStore.js';
import { getBrandApiKeys } from '../utils/brandLoader.js';
import { getPublicImageUrl } from '../utils/googleDrive.js';
import fetch from 'node-fetch';
import { GeminiFlashChatService } from '../services/geminiFlashChat.js';
import { parseParameterUpdatesFromChat, mergeParameterUpdates, generatePromptFromParameters } from '../services/imageParameters.js';

const USE_GEMINI_CHAT = process.env.USE_GEMINI_CHAT === 'true';

export async function handleChat(req, res) {
  try {
    const { messages, jobId } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const job = await getJob(jobId);
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
          
          // More flexible detection: allow surrounding words and punctuation
          const isConfirmation = /\b(yes|yeah|yep|ok|okay|sure|proceed|go ahead|do it|confirm|approved?|looks good|perfect|let'?s do it|go for it)\b/i.test(normalizedResponse);
          const isRejection = /\b(no|nope|cancel|stop|don'?t|nevermind|wait|not now|hold on|hold off)\b/i.test(normalizedResponse);
          
          if (isConfirmation && !isRejection) {
            console.log('[Chat] User confirmed edit. Triggering asynchronously:', job.pendingEdit.newPrompt);
            
            const requestBody = {
              jobId,
              newPrompt: job.pendingEdit.newPrompt
            };
            
            if (job.pendingEdit.imageIds && job.pendingEdit.imageIds.length > 0) {
              requestBody.imageIds = job.pendingEdit.imageIds;
            }

            delete job.pendingEdit;

            fetch(`http://localhost:3000/api/re-edit`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(requestBody)
            }).then(response => {
              if (response.ok) {
                console.log('[Chat] Re-edit triggered successfully in background');
              } else {
                console.error('[Chat] Re-edit failed:', response.status);
              }
            }).catch(error => {
              console.error('[Chat] Re-edit trigger error:', error.message);
            });

            return res.json({
              success: true,
              message: `Perfect! I'm now applying the changes: "${requestBody.newPrompt}". The processing will take about 30-60 seconds. The images will automatically refresh once complete.`,
              editTriggered: true
            });
          } else if (isRejection) {
            delete job.pendingEdit;
            return res.json({
              success: true,
              message: 'Okay, I\'ve cancelled that edit. What would you like me to do instead?'
            });
          } else {
            // Ambiguous response - keep pending edit and remind user
            console.log('[Chat] Ambiguous response to confirmation request:', normalizedResponse);
            return res.json({
              success: true,
              message: `I'm still waiting for your confirmation to proceed with the edit:\n\n"${job.pendingEdit.newPrompt}"\n\nPlease reply "yes" to proceed or "no" to cancel.`
            });
          }
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
      },
      {
        type: 'function',
        function: {
          name: 'adjustParameters',
          description: 'Adjust specific visual parameters like font size, gradient opacity, margins without full re-generation. Use this for quick adjustments like "make the title bigger", "darker gradient", "move text up".',
          parameters: {
            type: 'object',
            properties: {
              imageIds: {
                type: 'array',
                items: { type: 'string' },
                description: 'Optional: Array of image IDs to adjust. If not provided, adjusts all images.'
              },
              adjustments: {
                type: 'object',
                description: 'Parameter adjustments to apply',
                properties: {
                  title: {
                    type: 'object',
                    properties: {
                      fontSize: { type: 'number', description: 'New font size in pixels' },
                      text: { type: 'string', description: 'New title text' },
                      alignment: { type: 'string', enum: ['left', 'center', 'right'] }
                    }
                  },
                  subtitle: {
                    type: 'object',
                    properties: {
                      fontSize: { type: 'number', description: 'New font size in pixels' },
                      text: { type: 'string', description: 'New subtitle text' }
                    }
                  },
                  gradient: {
                    type: 'object',
                    properties: {
                      opacity: { type: 'number', description: 'Opacity from 0.1 to 0.6' },
                      heightPercent: { type: 'number', description: 'Height coverage from 10 to 40 percent' }
                    }
                  },
                  margins: {
                    type: 'object',
                    properties: {
                      topPercent: { type: 'number', description: 'Top margin from 2 to 25 percent' },
                      leftPercent: { type: 'number', description: 'Left margin from 2 to 20 percent' }
                    }
                  }
                }
              }
            },
            required: ['adjustments']
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
      
      // Handle parameter adjustments (quick edits without full regeneration)
      if (toolCall.function.name === 'adjustParameters') {
        if (!jobId || !job) {
          return res.status(400).json({
            success: false,
            error: 'Invalid or missing job ID. Cannot adjust parameters.'
          });
        }

        let args;
        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch (parseError) {
          console.error('[Chat] Failed to parse adjustParameters arguments:', parseError);
          return res.status(500).json({
            success: false,
            error: 'Failed to process parameter adjustment.'
          });
        }

        const adjustments = args.adjustments;
        const imageIds = args.imageIds || null;
        
        if (!adjustments || Object.keys(adjustments).length === 0) {
          return res.status(400).json({
            success: false,
            error: 'No adjustments specified.'
          });
        }

        console.log('[Chat] Parameter adjustment requested:', JSON.stringify(adjustments));
        
        // Apply parameter adjustments to selected images
        const imagesToAdjust = imageIds && imageIds.length > 0
          ? job.editedImages.filter(img => imageIds.includes(img.editedImageId) || imageIds.includes(img.id))
          : job.editedImages;
        
        let adjustedCount = 0;
        const adjustmentSummary = [];
        
        for (const image of imagesToAdjust) {
          if (!image.parameters) {
            console.log(`[Chat] Image ${image.name} has no parameters, skipping adjustment`);
            continue;
          }
          
          // Merge the adjustments with existing parameters
          const updatedParams = mergeParameterUpdates(image.parameters, adjustments);
          image.parameters = updatedParams;
          adjustedCount++;
          
          console.log(`[Chat] Updated parameters for ${image.name}, version: ${updatedParams.version}`);
        }
        
        // Save the updated job
        if (adjustedCount > 0) {
          await updateJob(jobId, { editedImages: job.editedImages });
          
          // Build summary of what was changed
          if (adjustments.title?.fontSize) adjustmentSummary.push(`title size to ${adjustments.title.fontSize}px`);
          if (adjustments.subtitle?.fontSize) adjustmentSummary.push(`subtitle size to ${adjustments.subtitle.fontSize}px`);
          if (adjustments.gradient?.opacity) adjustmentSummary.push(`gradient opacity to ${Math.round(adjustments.gradient.opacity * 100)}%`);
          if (adjustments.gradient?.heightPercent) adjustmentSummary.push(`gradient height to ${adjustments.gradient.heightPercent}%`);
          if (adjustments.margins?.topPercent) adjustmentSummary.push(`top margin to ${adjustments.margins.topPercent}%`);
          if (adjustments.margins?.leftPercent) adjustmentSummary.push(`left margin to ${adjustments.margins.leftPercent}%`);
          if (adjustments.title?.alignment) adjustmentSummary.push(`text alignment to ${adjustments.title.alignment}`);
          
          const summaryText = adjustmentSummary.length > 0 
            ? `Changed: ${adjustmentSummary.join(', ')}` 
            : 'Parameters updated';
          
          // Now trigger re-generation with updated parameters
          const regenerateImages = imagesToAdjust.filter(img => img.parameters);
          
          if (regenerateImages.length > 0) {
            // Generate new prompts from updated parameters
            const regenerateIds = regenerateImages.map(img => img.editedImageId);
            const newPrompt = generatePromptFromParameters(regenerateImages[0].parameters);
            
            // Store pending regeneration
            job.pendingEdit = {
              newPrompt: newPrompt,
              imageIds: regenerateIds,
              timestamp: Date.now(),
              isParameterEdit: true
            };
            
            console.log('[Chat] Stored pending parameter-based regeneration');
            
            return res.json({
              success: true,
              message: `I've updated the parameters for ${adjustedCount} image${adjustedCount > 1 ? 's' : ''}.\n\n${summaryText}\n\nWould you like me to regenerate the images with these new settings? (Reply "yes" to proceed)`
            });
          }
        }
        
        return res.json({
          success: true,
          message: `I adjusted parameters for ${adjustedCount} images. ${adjustedCount === 0 ? 'Note: Some images may not have editable parameters yet - they need to be processed first.' : ''}`
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
