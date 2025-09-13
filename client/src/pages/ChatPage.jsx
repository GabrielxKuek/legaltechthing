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

  const simulateAIResponse = (userMessage) => {
    setIsTyping(true);
    
    setTimeout(() => {
      let response = "";
      
      if (userMessage.toLowerCase().includes('contract')) {
        response = "I can help you with contract analysis! Here are key areas I can assist with:\n\n• Contract interpretation and clause analysis\n• Risk assessment in contractual terms\n• Standard vs. non-standard provisions\n• Negotiation strategies\n• Compliance requirements\n\nWhat specific aspect of contract law would you like to explore?";
      } else if (userMessage.toLowerCase().includes('litigation')) {
        response = "Litigation strategy is complex. I can help you think through:\n\n• Case theory development\n• Evidence gathering strategies\n• Motion practice considerations\n• Discovery planning\n• Settlement analysis\n\nWhat type of litigation matter are you working on?";
      } else if (userMessage.toLowerCase().includes('corporate')) {
        response = "Corporate law covers many areas:\n\n• Business formation and structure\n• Corporate governance\n• M&A transactions\n• Securities compliance\n• Board responsibilities\n\nWhich corporate law topic interests you?";
      } else {
        response = `I understand you're asking about: "${userMessage}"\n\nAs your legal AI assistant, I can help with:\n\n• Legal research and analysis\n• Case law interpretation\n• Document drafting guidance\n• Regulatory compliance\n• Practice area insights\n\nCould you provide more details about what you'd like to explore?`;
      }
      
      setMessages(prev => [...prev, {
        id: Date.now(),
        content: response,
        isBot: true
      }]);
      setIsTyping(false);
    }, 1500);
  };

  const handleSendMessage = (message) => {
    const newMessage = {
      id: Date.now(),
      content: message,
      isBot: false
    };
    
    setMessages(prev => [...prev, newMessage]);
    simulateAIResponse(message);
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
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            </div>
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