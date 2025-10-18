import OpenAI from 'openai';
import { getJob } from '../utils/jobStore.js';
import fetch from 'node-fetch';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function handleChat(req, res) {
  try {
    const { messages, jobId } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const job = getJob(jobId);
    let context = '';
    let imageList = '';
    
    if (job) {
      if (job.promptText) {
        context = `The user's original editing instructions were: "${job.promptText}". `;
      }
      if (job.editedImages && job.editedImages.length > 0) {
        context += `They have ${job.editedImages.length} edited images. `;
        imageList = `\n\nAvailable images:\n${job.editedImages.map((img, idx) => `${idx + 1}. ${img.originalName || img.name} (ID: ${img.id})`).join('\n')}`;
      }
    }

    const systemMessage = {
      role: 'system',
      content: `You are CORSAIR's AI image editing assistant with the ability to ACTUALLY EDIT IMAGES in real-time. ${context}

When users ask you to edit images, you can trigger actual image editing by calling the editImages function. You can edit:
- SPECIFIC images: "fix image 3", "edit the first one", "change images 1 and 5"
- ALL images: "fix all images", "edit everything", "change all the text"

You can make changes like: fix typos in text, adjust text positioning, change colors, modify gradients, add/remove elements, etc.

When the user mentions specific images (by number, position, or name), extract those image IDs and pass them to the function. If they say "all" or don't specify, edit all images.${imageList}

After triggering an edit, confirm what you're doing. Be helpful, creative, and focus on creating visuals that convey performance and quality with CORSAIR's premium aesthetic.`
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

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [systemMessage, ...messages],
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

        console.log('[Chat] AI triggering image re-edit with prompt:', args.newPrompt);
        if (imageIds) {
          console.log('[Chat] Targeting specific images:', imageIds);
        }
        
        // Call the re-edit endpoint
        try {
          const requestBody = {
            jobId,
            newPrompt: args.newPrompt
          };
          
          if (imageIds && imageIds.length > 0) {
            requestBody.imageIds = imageIds;
          }

          const reEditResponse = await fetch(`http://localhost:3000/api/re-edit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
          });

          if (reEditResponse.ok) {
            return res.json({
              success: true,
              message: `I'm now editing ${targetDescription} with these instructions: "${args.newPrompt}". The processing will take about 30-60 seconds. Refresh the page to see the updated results!`,
              editTriggered: true
            });
          } else {
            const errorData = await reEditResponse.json().catch(() => ({}));
            throw new Error(errorData.error || 'Re-edit request failed');
          }
        } catch (editError) {
          console.error('[Chat] Edit trigger error:', editError);
          return res.status(500).json({
            success: false,
            error: `Failed to trigger image edit: ${editError.message}. Please try again or use the manual re-edit feature.`
          });
        }
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
