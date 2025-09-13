import React from 'react';
import { Bot, User, Scale, FileText, Building, CheckCircle, Clock, AlertCircle } from 'lucide-react';

export default function Message({ message, isBot }) {
  // Handle both string and object content
  const renderContent = () => {
    if (typeof message.content === 'string') {
      return (
        <div className="text-base leading-relaxed whitespace-pre-wrap">
          {message.content}
        </div>
      );
    } else if (typeof message.content === 'object' && message.content !== null) {
      // Check if it's the new API response format
      if (message.content.answer && typeof message.content.answer === 'string') {
        return renderApiResponse(message.content);
      }
      // Handle legacy object content with institution and topics
      return (
        <div className="space-y-3">
          {message.content.institution && (
            <div className="flex items-start gap-2">
              <Building className="w-4 h-4 mt-1 text-blue-600 flex-shrink-0" />
              <div>
                <span className="font-semibold text-gray-700">Institution: </span>
                <span className="text-gray-800">{message.content.institution}</span>
              </div>
            </div>
          )}
          {message.content.topics && (
            <div className="flex items-start gap-2">
              <FileText className="w-4 h-4 mt-1 text-blue-600 flex-shrink-0" />
              <div>
                <span className="font-semibold text-gray-700">Topics: </span>
                <span className="text-gray-800">{message.content.topics}</span>
              </div>
            </div>
          )}
        </div>
      );
    }
    return <div className="text-red-600 italic">Invalid message content</div>;
  };

  const renderApiResponse = (content) => {
    const { answer, sources, model_used, total_cases_in_db } = content;
    
    return (
      <div className="space-y-6">
        {/* Main Answer */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-800 text-lg">Legal Analysis</h3>
          </div>
          <div className="text-base leading-relaxed text-gray-800 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg border-l-4 border-blue-500">
            {answer}
          </div>
        </div>

        {/* Sources Section */}
        {sources && sources.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-green-600" />
              <h3 className="font-semibold text-gray-800">Referenced Cases</h3>
            </div>
            <div className="grid gap-3">
              {sources.map((source, index) => (
                <div key={index} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold text-gray-800 text-sm">{source.title}</h4>
                    <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full font-medium">
                      {Math.round(parseFloat(source.similarity) * 100)}% match
                    </span>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Building className="w-3 h-3 text-gray-500" />
                      <span className="text-gray-600">{source.institution}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 font-medium">Case ID:</span>
                      <code className="bg-gray-100 px-2 py-1 rounded text-xs">{source.case_id}</code>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {getStatusIcon(source.status)}
                      <span className="text-gray-600">{source.status}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-gray-200">
          <div className="flex items-center gap-4">
            {model_used && (
              <span>Model: <code className="bg-gray-100 px-1 rounded">{model_used}</code></span>
            )}
            {total_cases_in_db && (
              <span>Database: {total_cases_in_db} total cases</span>
            )}
          </div>
        </div>
      </div>
    );
  };

  const getStatusIcon = (status) => {
    const statusLower = status?.toLowerCase() || '';
    
    if (statusLower.includes('decided') || statusLower.includes('award rendered')) {
      return <CheckCircle className="w-3 h-3 text-green-600" />;
    } else if (statusLower.includes('pending')) {
      return <Clock className="w-3 h-3 text-yellow-600" />;
    } else {
      return <AlertCircle className="w-3 h-3 text-gray-500" />;
    }
  };

  return (
    <div className={`flex gap-4 mb-6 ${isBot ? 'justify-start' : 'justify-end'}`}>
      {isBot && (
        <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
          <Bot className="w-5 h-5 text-white" />
        </div>
      )}
      
      <div className="flex flex-col max-w-4xl">
        <div className={`px-6 py-4 rounded-2xl ${
          isBot 
            ? 'bg-white border border-gray-200 shadow-sm' 
            : 'bg-blue-600 text-white'
        }`}>
          {renderContent()}
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