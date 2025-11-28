import { useState, useEffect, useRef, useCallback } from 'react';
import { Button, Input, Spinner } from '../atoms';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  username: string;
  testId?: string;
}

export function ChatPanel({
  isOpen,
  onClose,
  userId,
  username,
  testId = 'chat-panel',
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Load chat history when panel opens
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      loadHistory();
    }
  }, [isOpen]);

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const response = await fetch(`/.proxy/api/chat/history?userId=${userId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.messages) {
          setMessages(
            data.messages.map((msg: { id: string; role: string; content: string; timestamp: string }) => ({
              ...msg,
              timestamp: new Date(msg.timestamp),
            }))
          );
        }
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/.proxy/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          username,
          message: userMessage.content,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const assistantMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.response || 'Sorry, I could not process your request.',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        const assistantMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Sorry, there was an error processing your message.',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Failed to connect to chat server.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed bottom-4 right-4 w-80 h-96 bg-discord-background-secondary rounded-lg shadow-lg flex flex-col border border-discord-background-tertiary z-50"
      data-testid={testId}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-discord-background-tertiary"
        data-testid={`${testId}-header`}
      >
        <h3 className="text-sm font-semibold text-discord-text-normal">
          Chat with FumbleBot
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          testId={`${testId}-close-btn`}
          aria-label="Close chat"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </Button>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto p-3 space-y-3"
        data-testid={`${testId}-messages`}
      >
        {isLoadingHistory ? (
          <div className="flex items-center justify-center h-full">
            <Spinner size="md" testId={`${testId}-loading`} />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-discord-text-muted text-sm py-8">
            <p>Start a conversation with FumbleBot!</p>
            <p className="mt-2 text-xs">Ask about campaigns, characters, or rules.</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              data-testid={`${testId}-message-${msg.id}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  msg.role === 'user'
                    ? 'bg-discord-blurple text-white'
                    : 'bg-discord-background-tertiary text-discord-text-normal'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-discord-background-tertiary rounded-lg px-3 py-2">
              <Spinner size="sm" testId={`${testId}-typing`} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div
        className="p-3 border-t border-discord-background-tertiary"
        data-testid={`${testId}-input-area`}
      >
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            disabled={isLoading}
            testId={`${testId}-input`}
          />
          <Button
            variant="primary"
            size="sm"
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            testId={`${testId}-send-btn`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </Button>
        </div>
      </div>
    </div>
  );
}
