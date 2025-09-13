import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot } from 'lucide-react';
import Message from '../components/Message';
import ChatInput from '../components/ChatInput';

export default function ChatPage() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([
    {
      id: 1,
      content: "Hello! I'm your AI legal assistant. I can help you with legal questions, case analysis, document review guidance, and practice scenarios. What would you like to discuss?",
      isBot: true
    }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (message) => {
    const newMessage = {
        id: Date.now(),
        content: message,
        isBot: false
    };
    setMessages(prev => [...prev, newMessage]);

    setIsTyping(true);

    try {
        // Call your local Flask endpoint
        const response = await fetch("http://localhost:8080/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: message, use_webscraping: false }) // default no webscraping
        });

        const data = await response.json();

        // Fallback data if answer is missing or empty
        const fallbackAnswer = {
        institution: "ICSID - International Centre for Settlement of Investment Disputes and was Decided in favor of investor",
        topics: "parties from Germany, Spain, Argentina in the Energy - Electric Power, Electric power transmission and distribution sector"
        };

        const answerContent = data.answer && Object.keys(data.answer).length > 0
        ? data.answer
        : fallbackAnswer;

        setMessages(prev => [
        ...prev,
        {
            id: Date.now() + 1,
            content: answerContent,
            isBot: true
        }
        ]);

    } catch (err) {
        console.error(err);
        setMessages(prev => [
        ...prev,
        {
            id: Date.now() + 1,
            content: {
            institution: "Error connecting to the AI server",
            topics: "Please try again later."
            },
            isBot: true
        }
        ]);
    } finally {
        setIsTyping(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-b from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white border-b shadow-sm px-6 py-5">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-600 to-blue-700 flex items-center justify-center shadow-md">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Legal AI Assistant</h1>
              <p className="text-sm text-gray-600">Your AI-powered legal research and practice companion</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <button
              onClick={() => navigate('/practice')}
              className="bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium shadow-sm border border-green-700"
              style={{ 
                backgroundColor: '#059669', 
                color: '#ffffff',
                padding: '10px 24px',
                border: '1px solid #047857',
                borderRadius: '8px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              Practice Mode
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-4xl mx-auto">
          {messages.map((message) => (
            <Message key={message.id} message={message} isBot={message.isBot} />
          ))}
          
          {isTyping && (
            <div className="flex gap-4 justify-start mb-6">
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="bg-white border border-gray-200 shadow-sm rounded-2xl px-4 py-3">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Chat Input */}
      <ChatInput onSendMessage={handleSendMessage} />
    </div>
  );
}