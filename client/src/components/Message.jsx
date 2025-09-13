import React from 'react';
import { Bot, User } from 'lucide-react';

export default function Message({ message, isBot }) {
  return (
    <div className={`flex gap-4 mb-6 ${isBot ? 'justify-start' : 'justify-end'}`}>
      {isBot && (
        <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
          <Bot className="w-5 h-5 text-white" />
        </div>
      )}
      
      <div className="flex flex-col max-w-2xl">
        <div className={`px-4 py-3 rounded-2xl ${
          isBot 
            ? 'bg-white border border-gray-200 shadow-sm' 
            : 'bg-blue-600 text-white'
        }`}>
          <div className="text-base leading-relaxed">
            {message.content}
          </div>
        </div>
      </div>
      
      {!isBot && (
        <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0">
          <User className="w-5 h-5 text-white" />
        </div>
      )}
    </div>
  );
}