import OpenAI from 'openai';
import { getJob } from '../utils/jobStore.js';

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
    
    if (job) {
      if (job.promptText) {
        context = `The user's original editing instructions were: "${job.promptText}". `;
      }
      if (job.imageCount) {
        context += `They uploaded ${job.imageCount} images for editing. `;
      }
    }

    const systemMessage = {
      role: 'system',
      content: `You are CORSAIR's AI image editing assistant, helping users create professional marketing visuals for gaming and PC components. ${context}You provide expert advice on image editing, suggest improvements that align with CORSAIR's premium, high-performance brand aesthetic (dark themes, bold contrasts, yellow accents), and help users refine their editing instructions. Be helpful, creative, technically precise, and concise in your responses. Focus on creating visuals that convey performance and quality.`
    };

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [systemMessage, ...messages],
      temperature: 0.7,
      max_tokens: 500
    });

    res.json({
      success: true,
      message: completion.choices[0].message.content
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ 
      error: 'Chat request failed', 
      details: error.message 
    });
  }
}
