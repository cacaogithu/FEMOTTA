import { useState, useRef, useEffect } from 'react';
import { postJSON } from '../utils/api';
import './ChatWidget.css';

function ChatWidget({ jobId, onImageUpdated }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Welcome to CORSAIR AI Assistant. I can help you optimize and edit your product images. What would you like to change?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const pollingIntervalRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = { role: 'user', content: input };
    setMessages([...messages, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await postJSON('/api/chat', {
        messages: [...messages, userMessage],
        jobId
      });

      if (!response.ok) throw new Error('Chat request failed');

      const data = await response.json();
      setMessages([...messages, userMessage, { role: 'assistant', content: data.message }]);

      if (data.editTriggered && onImageUpdated) {
        console.log('[ChatWidget] Edit triggered, starting polling for completion...');
        startPollingForCompletion();
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages([...messages, userMessage, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error. Please try again.' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const startPollingForCompletion = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    let pollCount = 0;
    const maxPolls = 20;

    const pollForUpdates = async () => {
      try {
        pollCount++;
        console.log(`[ChatWidget] Polling attempt ${pollCount}/${maxPolls}`);
        
        const response = await fetch(`/api/results/poll/${jobId}`);
        const data = await response.json();
        
        if (data.status === 'completed') {
          console.log('[ChatWidget] Edit completed, triggering image refresh');
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
          if (onImageUpdated) {
            onImageUpdated();
          }
        } else if (pollCount >= maxPolls) {
          console.log('[ChatWidget] Max polls reached, stopping polling');
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      } catch (error) {
        console.error('[ChatWidget] Polling error:', error);
      }
    };

    pollForUpdates();
    pollingIntervalRef.current = setInterval(pollForUpdates, 3000);
  };

  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      <button 
        className="chat-toggle-btn"
        onClick={() => setIsOpen(!isOpen)}
        title="AI Assistant"
      >
        {isOpen ? '✕' : '💬'}
      </button>

      {isOpen && (
        <div className="chat-widget">
          <div className="chat-header">
            <h3>⚡ CORSAIR AI Assistant</h3>
            <button onClick={() => setIsOpen(false)} className="close-btn">✕</button>
          </div>

          <div className="chat-messages">
            {messages.map((msg, idx) => (
              <div key={idx} className={`message ${msg.role}`}>
                <div className="message-content">{msg.content}</div>
              </div>
            ))}
            {isLoading && (
              <div className="message assistant">
                <div className="message-content typing">
                  <span></span><span></span><span></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="chat-input-area">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me to edit your images..."
              rows={2}
            />
            <button 
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="send-btn"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default ChatWidget;
