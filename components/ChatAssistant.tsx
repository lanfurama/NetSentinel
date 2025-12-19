import React, { useState, useEffect, useRef } from 'react';
import { GenerateContentResponse, Chat } from "@google/genai";
import { Device, Alert, User } from '../types';
import { createChatSession, sendMessageStream } from '../services/geminiService';
import apiService from '../services/apiService';
import { MessageSquare, Send, X, Minimize2, Brain, ChevronRight, RefreshCw } from './Icons';

interface ChatAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  devices: Device[];
  alerts: Alert[];
  currentUser: User | null;
  initialContext?: string; // Pre-filled message from other components
}

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  isStreaming?: boolean;
}

// Helper function to parse error messages and return user-friendly text
const parseErrorMessage = (error: unknown): string => {
  try {
    // If it's an Error object, try to parse the message
    if (error instanceof Error) {
      const errorMessage = error.message;
      
      // Try to parse JSON error message
      try {
        const parsed = JSON.parse(errorMessage);
        if (parsed?.error) {
          // Handle Gemini API errors
          const apiError = parsed.error;
          
          // API key errors
          if (apiError.message?.includes('API key') || apiError.message?.includes('INVALID_ARGUMENT') || apiError.code === 400) {
            return "⚠️ **API Configuration Error**\n\nI'm unable to connect to the AI service. Please check that the API key is properly configured in the system settings.\n\nIf you're an administrator, please verify the `VITE_GEMINI_API_KEY` environment variable is set correctly.";
          }
          
          // Rate limit errors
          if (apiError.code === 429 || apiError.message?.includes('rate limit') || apiError.message?.includes('quota')) {
            return "⏱️ **Service Temporarily Unavailable**\n\nThe AI service is currently experiencing high demand. Please try again in a few moments.";
          }
          
          // Permission errors
          if (apiError.code === 403 || apiError.message?.includes('permission') || apiError.message?.includes('forbidden')) {
            return "🔒 **Access Denied**\n\nI don't have permission to access the AI service. Please contact your administrator.";
          }
          
          // Return a clean message if we can extract it
          if (apiError.message && typeof apiError.message === 'string') {
            // Check if message is another JSON string
            try {
              const nestedParsed = JSON.parse(apiError.message);
              if (nestedParsed?.error?.message) {
                const nestedMessage = nestedParsed.error.message;
                if (nestedMessage.includes('API key')) {
                  return "⚠️ **API Configuration Error**\n\nI'm unable to connect to the AI service. Please check that the API key is properly configured in the system settings.\n\nIf you're an administrator, please verify the `VITE_GEMINI_API_KEY` environment variable is set correctly.";
                }
                return `⚠️ **Service Error**\n\n${nestedMessage}`;
              }
            } catch {
              // Not nested JSON, use the message directly
            }
            return `⚠️ **Service Error**\n\n${apiError.message}`;
          }
        }
      } catch {
        // Not JSON, check for common error patterns in the message string
        if (errorMessage.includes('API key') || errorMessage.includes('API key not valid')) {
          return "⚠️ **API Configuration Error**\n\nI'm unable to connect to the AI service. Please check that the API key is properly configured.";
        }
        
        if (errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('Connection')) {
          return "🌐 **Connection Error**\n\nI'm unable to connect to the AI service. Please check your internet connection and try again.";
        }
        
        if (errorMessage.includes('timeout')) {
          return "⏱️ **Request Timeout**\n\nThe request took too long to process. Please try again.";
        }
      }
      
      // Fallback: return a generic message
      return "⚠️ **Service Unavailable**\n\nI'm experiencing technical difficulties. Please try again in a moment.\n\nIf the problem persists, please contact your system administrator.";
    }
    
    // If it's a string
    if (typeof error === 'string') {
      try {
        const parsed = JSON.parse(error);
        return parseErrorMessage(parsed);
      } catch {
        if (error.includes('API key')) {
          return "⚠️ **API Configuration Error**\n\nI'm unable to connect to the AI service. Please check that the API key is properly configured.";
        }
        return "⚠️ **Error**\n\nAn unexpected error occurred. Please try again.";
      }
    }
    
    // Default fallback
    return "⚠️ **Service Unavailable**\n\nI'm unable to process your request at the moment. Please try again later.";
  } catch {
    // Ultimate fallback
    return "⚠️ **Connection Error**\n\nPlease try again in a moment.";
  }
};

const ChatAssistant: React.FC<ChatAssistantProps> = ({ isOpen, onClose, devices, alerts, currentUser, initialContext }) => {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'model', text: 'Hello! I am NetSentinel AI. I can help you troubleshoot alerts, analyze imports, or check system health.' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [chatSession, setChatSession] = useState<Chat | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize Chat Session
  useEffect(() => {
    setChatSession(createChatSession());
  }, []);

  // Load messages when opening
  useEffect(() => {
    if (isOpen && currentUser && !isLoadingHistory) {
      loadMessages();
    }
  }, [isOpen, currentUser]);

  const loadMessages = async () => {
    if (!currentUser) return;
    
    setIsLoadingHistory(true);
    try {
      const response = await apiService.getMessages(currentUser.username);
      
      if (response.success && response.data && response.data.length > 0) {
        const loadedMessages = response.data.map((msg: any) => ({
          id: msg.id,
          role: msg.role,
          text: msg.content,
          isStreaming: false
        }));
        setMessages(loadedMessages);
      } else {
        // No messages, show greeting
        setMessages([
          { id: '1', role: 'model', text: 'Hello! I am NetSentinel AI. I can help you troubleshoot alerts, analyze imports, or check system health.' }
        ]);
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
      // If loading fails, show greeting
      setMessages([
        { id: '1', role: 'model', text: 'Hello! I am NetSentinel AI. I can help you troubleshoot alerts, analyze imports, or check system health.' }
      ]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Handle Initial Context (e.g., from Admin Panel error)
  useEffect(() => {
    if (initialContext && isOpen && chatSession) {
      handleSendMessage(initialContext);
    }
  }, [initialContext, isOpen, chatSession]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (text: string = input) => {
    if ((!text.trim() && !initialContext) || !chatSession) return;

    const userMsgId = Date.now().toString();
    const aiMsgId = (Date.now() + 1).toString();

    // 1. Add User Message
    setMessages(prev => [...prev, { id: userMsgId, role: 'user', text: text }]);
    setInput('');
    setIsTyping(true);

    // Save user message to database
    if (currentUser) {
      try {
        await apiService.addMessage(currentUser.username, 'user', text);
      } catch (error) {
        console.error('Failed to save user message:', error);
      }
    }

    try {
      // 2. Add Placeholder AI Message
      setMessages(prev => [...prev, { id: aiMsgId, role: 'model', text: '', isStreaming: true }]);

      // 3. Prepare Context Snapshot (pass current state to AI)
      const currentSystemContext = {
        totalDevices: devices.length,
        offlineDevices: devices.filter(d => d.status === 'OFFLINE').map(d => d.name),
        criticalAlerts: alerts.length
      };

      // 4. Stream Response
      const result = await sendMessageStream(chatSession, text, currentSystemContext);
      
      let fullText = '';
      for await (const chunk of result) {
        const c = chunk as GenerateContentResponse;
        // Extract text from response
        // GenerateContentResponse.text is a getter that returns string
        const chunkText = c.text || '';
        fullText += chunkText;
        
        setMessages(prev => prev.map(msg => 
          msg.id === aiMsgId ? { ...msg, text: fullText } : msg
        ));
      }

      setMessages(prev => prev.map(msg => 
        msg.id === aiMsgId ? { ...msg, isStreaming: false } : msg
      ));

      // Save AI response to database (after stream completes)
      if (currentUser && fullText && fullText.trim().length > 0) {
        try {
          console.log('💾 Saving AI message to database:', { length: fullText.length, preview: fullText.substring(0, 50) });
          const response = await apiService.addMessage(currentUser.username, 'model', fullText);
          if (response.success) {
            console.log('✅ AI message saved successfully');
          } else {
            console.error('❌ Failed to save AI message:', response);
          }
        } catch (error) {
          console.error('❌ Failed to save AI message:', error);
        }
      } else {
        console.warn('⚠️ Not saving AI message:', { 
          hasUser: !!currentUser, 
          hasText: !!fullText, 
          textLength: fullText?.length || 0 
        });
      }

    } catch (error) {
      console.error("Chat Error:", error);
      
      // Parse error and create user-friendly message
      const userFriendlyMessage = parseErrorMessage(error);
      
      // Update UI with user-friendly error message
      setMessages(prev => prev.map(msg => 
        msg.id === aiMsgId ? { ...msg, text: userFriendlyMessage, isStreaming: false } : msg
      ));

      // Save error message to database
      if (currentUser) {
        try {
          console.log('💾 Saving AI error message to database');
          await apiService.addMessage(currentUser.username, 'model', userFriendlyMessage);
          console.log('✅ AI error message saved successfully');
        } catch (saveError) {
          console.error('❌ Failed to save AI error message:', saveError);
        }
      }
    } finally {
      setIsTyping(false);
    }
  };

  const handleQuickAction = (action: string) => {
    const prompts: Record<string, string> = {
      'status': 'What is the current system health status?',
      'offline': 'Which devices are offline and why?',
      'fix_snmp': 'How do I fix standard SNMP connection timeouts?',
    };
    handleSendMessage(prompts[action]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-6 right-6 w-96 h-[600px] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col z-50 animate-fade-in overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-900 p-4 flex justify-between items-center border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-purple-300" />
          <h3 className="font-bold text-white">NetSentinel Assistant</h3>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded text-slate-300">
            <Minimize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900 custom-scrollbar">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl p-3 text-sm leading-relaxed ${
              msg.role === 'user' 
                ? 'bg-blue-600 text-white rounded-br-none' 
                : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-none'
            }`}>
              {msg.text ? (
                <div className="markdown-body" dangerouslySetInnerHTML={{ 
                  __html: msg.text.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>') 
                }} />
              ) : (
                <div className="flex gap-1 items-center h-5">
                   <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
                   <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-75"></div>
                   <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-150"></div>
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions (Only show if not typing) */}
      {!isTyping && messages.length < 3 && (
        <div className="px-4 pb-2 flex gap-2 overflow-x-auto">
          <button onClick={() => handleQuickAction('status')} className="whitespace-nowrap px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-full text-xs text-blue-300 transition-colors">
            Check Status
          </button>
          <button onClick={() => handleQuickAction('offline')} className="whitespace-nowrap px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-full text-xs text-red-300 transition-colors">
            Offline Devices
          </button>
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 bg-slate-900 border-t border-slate-800">
        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent placeholder-slate-500"
            placeholder="Type a message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            disabled={isTyping}
          />
          <button 
            onClick={() => handleSendMessage()}
            disabled={!input.trim() || isTyping}
            className="p-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl transition-colors"
          >
            {isTyping ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatAssistant;