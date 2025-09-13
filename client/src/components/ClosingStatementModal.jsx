import React, { useState } from 'react';
import { 
  FileText, 
  X, 
  Scale, 
  Building,
  Users,
  AlertCircle
} from 'lucide-react';

export default function ClosingStatementModal({ isOpen, onClose, chatMessages = [] }) {
  const [formData, setFormData] = useState({
    caseTitle: '',
    caseNumber: '',
    court: '',
    date: new Date().toISOString().split('T')[0],
    attorney: '',
    client: '',
    caseType: 'civil',
    jurisdiction: ''
  });
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const extractChatContext = () => {
    // Extract relevant information from chat messages
    const botMessages = chatMessages.filter(msg => msg.isBot);
    
    let relevantCases = [];
    let keyLegalPoints = [];
    let institutions = [];
    
    botMessages.forEach(msg => {
      if (typeof msg.content === 'object' && msg.content.sources) {
        // Extract case information
        msg.content.sources.forEach(source => {
          relevantCases.push({
            title: source.title,
            institution: source.institution,
            status: source.status,
            similarity: source.similarity
          });
          if (!institutions.includes(source.institution)) {
            institutions.push(source.institution);
          }
        });
      }
      
      if (typeof msg.content === 'object' && msg.content.answer) {
        // Extract key legal points from AI responses
        const answer = msg.content.answer;
        if (answer.includes('precedent') || answer.includes('ruling') || answer.includes('court')) {
          keyLegalPoints.push(answer);
        }
      }
    });

    return { relevantCases, keyLegalPoints, institutions };
  };

  const downloadPDF = async (statement) => {
    try {
      // Dynamic import of jsPDF
      const { default: jsPDF } = await import('jspdf');
      
      const doc = new jsPDF();
      
      // Set margins and page dimensions
      const pageWidth = doc.internal.pageSize.width;
      const margin = 20;
      const textWidth = pageWidth - (margin * 2);
      
      // Title
      doc.setFontSize(14);
      doc.setFont('times', 'bold');
      doc.text('CLOSING STATEMENT', pageWidth / 2, 30, { align: 'center' });
      
      // Case information
      doc.setFontSize(12);
      doc.setFont('times', 'normal');
      let yPosition = 50;
      
      doc.text(`IN THE ${formData.court.toUpperCase()}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 10;
      
      if (formData.jurisdiction) {
        doc.text(formData.jurisdiction.toUpperCase(), pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 10;
      }
      
      doc.text(formData.caseTitle.toUpperCase(), pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 10;
      
      doc.text(`Case No. ${formData.caseNumber}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 20;
      
      // Statement content
      doc.setFontSize(11);
      const lines = doc.splitTextToSize(statement, textWidth);
      
      lines.forEach(line => {
        if (yPosition > 250) { // Check if we need a new page
          doc.addPage();
          yPosition = 20;
        }
        doc.text(line, margin, yPosition);
        yPosition += 6;
      });
      
      // Signature block
      yPosition += 20;
      if (yPosition > 220) {
        doc.addPage();
        yPosition = 20;
      }
      
      doc.text('Respectfully submitted,', margin, yPosition);
      yPosition += 20;
      doc.text('_________________________________', margin, yPosition);
      yPosition += 10;
      doc.text(formData.attorney, margin, yPosition);
      yPosition += 8;
      doc.text(`Attorney for ${formData.client}`, margin, yPosition);
      yPosition += 8;
      doc.text(`Date: ${formData.date}`, margin, yPosition);
      
      // Save the PDF
      doc.save(`Closing_Statement_${formData.caseTitle.replace(/\s+/g, '_')}_${formData.caseNumber}.pdf`);
      
    } catch (error) {
      console.error('PDF generation failed, falling back to text download:', error);
      
      // Fallback to text download if jsPDF fails
      const pdfContent = `
IN THE ${formData.court.toUpperCase()}
${formData.jurisdiction ? `${formData.jurisdiction.toUpperCase()}` : ''}

${formData.caseTitle.toUpperCase()}

Case No. ${formData.caseNumber}

CLOSING STATEMENT

${statement}

Respectfully submitted,

_________________________________
${formData.attorney}
Attorney for ${formData.client}

Date: ${formData.date}
      `.trim();

      const blob = new Blob([pdfContent], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Closing_Statement_${formData.caseTitle.replace(/\s+/g, '_')}_${formData.caseNumber}.txt`;
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }
  };

  const generateStatement = async () => {
    setIsGenerating(true);
    
    const chatContext = extractChatContext();
    
    try {
      // Prepare prompt for the model
      const prompt = `Generate a closing statement for this case given the relevant info:
      
Case: ${formData.caseTitle}
Case Number: ${formData.caseNumber}
Court: ${formData.court}
Attorney: ${formData.attorney}
Client: ${formData.client}
Case Type: ${formData.caseType}
${formData.jurisdiction ? `Jurisdiction: ${formData.jurisdiction}` : ''}

Chat Context:
${chatContext.relevantCases.length > 0 ? `Relevant Cases: ${JSON.stringify(chatContext.relevantCases)}` : ''}
${chatContext.keyLegalPoints.length > 0 ? `Key Legal Points: ${chatContext.keyLegalPoints.join(' ')}` : ''}
${chatContext.institutions.length > 0 ? `Institutions: ${chatContext.institutions.join(', ')}` : ''}`;

      // Send to your API
      const response = await fetch("http://localhost:8080/openai/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: prompt, use_webscraping: false })
      });

      const data = await response.json();
      
      // Extract the statement from response
      const statement = typeof data.answer === 'string' ? data.answer : 
                       typeof data.answer === 'object' && data.answer.answer ? data.answer.answer :
                       'Error generating closing statement. Please try again.';

      // Download PDF immediately
      await downloadPDF(statement);
      
      // Close modal
      onClose();
      
    } catch (error) {
      console.error('Error generating statement:', error);
      alert('Error generating closing statement. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const isFormValid = () => {
    return formData.caseTitle && formData.caseNumber && formData.court && 
           formData.attorney && formData.client;
  };

  const renderInputForm = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Case Information */}
      <div style={{ 
        backgroundColor: '#eff6ff', 
        borderRadius: '12px', 
        padding: '24px' 
      }}>
        <h3 style={{ 
          fontSize: '18px', 
          fontWeight: '600', 
          color: '#1f2937', 
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Scale className="w-5 h-5" style={{ color: '#2563eb' }} />
          Case Information
        </h3>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
          gap: '16px' 
        }}>
          <div>
            <label style={{ 
              display: 'block', 
              fontSize: '14px', 
              fontWeight: '500', 
              color: '#374151', 
              marginBottom: '8px' 
            }}>
              Case Title *
            </label>
            <input
              type="text"
              value={formData.caseTitle}
              onChange={(e) => handleInputChange('caseTitle', e.target.value)}
              placeholder="Smith v. Johnson"
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#2563eb'}
              onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
            />
          </div>
          <div>
            <label style={{ 
              display: 'block', 
              fontSize: '14px', 
              fontWeight: '500', 
              color: '#374151', 
              marginBottom: '8px' 
            }}>
              Case Number *
            </label>
            <input
              type="text"
              value={formData.caseNumber}
              onChange={(e) => handleInputChange('caseNumber', e.target.value)}
              placeholder="2024-CV-12345"
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#2563eb'}
              onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
            />
          </div>
          <div>
            <label style={{ 
              display: 'block', 
              fontSize: '14px', 
              fontWeight: '500', 
              color: '#374151', 
              marginBottom: '8px' 
            }}>
              Court *
            </label>
            <input
              type="text"
              value={formData.court}
              onChange={(e) => handleInputChange('court', e.target.value)}
              placeholder="Superior Court of California"
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#2563eb'}
              onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
            />
          </div>
          <div>
            <label style={{ 
              display: 'block', 
              fontSize: '14px', 
              fontWeight: '500', 
              color: '#374151', 
              marginBottom: '8px' 
            }}>
              Jurisdiction
            </label>
            <input
              type="text"
              value={formData.jurisdiction}
              onChange={(e) => handleInputChange('jurisdiction', e.target.value)}
              placeholder="County of Los Angeles"
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#2563eb'}
              onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
            />
          </div>
        </div>
      </div>

      {/* Party Information */}
      <div style={{ 
        backgroundColor: '#f0fdf4', 
        borderRadius: '12px', 
        padding: '24px' 
      }}>
        <h3 style={{ 
          fontSize: '18px', 
          fontWeight: '600', 
          color: '#1f2937', 
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Users className="w-5 h-5" style={{ color: '#16a34a' }} />
          Party Information
        </h3>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
          gap: '16px' 
        }}>
          <div>
            <label style={{ 
              display: 'block', 
              fontSize: '14px', 
              fontWeight: '500', 
              color: '#374151', 
              marginBottom: '8px' 
            }}>
              Attorney Name *
            </label>
            <input
              type="text"
              value={formData.attorney}
              onChange={(e) => handleInputChange('attorney', e.target.value)}
              placeholder="John Doe, Esq."
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#2563eb'}
              onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
            />
          </div>
          <div>
            <label style={{ 
              display: 'block', 
              fontSize: '14px', 
              fontWeight: '500', 
              color: '#374151', 
              marginBottom: '8px' 
            }}>
              Client Name *
            </label>
            <input
              type="text"
              value={formData.client}
              onChange={(e) => handleInputChange('client', e.target.value)}
              placeholder="ABC Corporation"
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#2563eb'}
              onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
            />
          </div>
          <div>
            <label style={{ 
              display: 'block', 
              fontSize: '14px', 
              fontWeight: '500', 
              color: '#374151', 
              marginBottom: '8px' 
            }}>
              Case Type
            </label>
            <select
              value={formData.caseType}
              onChange={(e) => handleInputChange('caseType', e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none',
                backgroundColor: 'white',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#2563eb'}
              onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
            >
              <option value="civil">Civil</option>
              <option value="criminal">Criminal</option>
              <option value="family">Family Law</option>
              <option value="corporate">Corporate</option>
              <option value="personal-injury">Personal Injury</option>
              <option value="employment">Employment</option>
              <option value="contract">Contract Dispute</option>
              <option value="tort">Tort</option>
            </select>
          </div>
          <div>
            <label style={{ 
              display: 'block', 
              fontSize: '14px', 
              fontWeight: '500', 
              color: '#374151', 
              marginBottom: '8px' 
            }}>
              Date
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => handleInputChange('date', e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#2563eb'}
              onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
            />
          </div>
        </div>
      </div>

      {/* Chat Context Info */}
      {chatMessages.length > 0 && (
        <div style={{ 
          backgroundColor: '#fffbeb', 
          border: '1px solid #f59e0b', 
          borderRadius: '12px', 
          padding: '16px' 
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            marginBottom: '8px' 
          }}>
            <AlertCircle className="w-4 h-4" style={{ color: '#d97706' }} />
            <span style={{ fontSize: '14px', fontWeight: '500', color: '#92400e' }}>
              Chat Context
            </span>
          </div>
          <p style={{ fontSize: '14px', color: '#a16207', margin: 0 }}>
            The closing statement will incorporate relevant legal analysis and case precedents from your current chat conversation.
          </p>
        </div>
      )}

      {/* Generate Button */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'flex-end', 
        gap: '12px', 
        paddingTop: '16px' 
      }}>
        <button
          onClick={onClose}
          style={{
            padding: '12px 24px',
            color: '#6b7280',
            backgroundColor: 'transparent',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = '#f3f4f6';
            e.target.style.color = '#374151';
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = 'transparent';
            e.target.style.color = '#6b7280';
          }}
        >
          Cancel
        </button>
        <button
          onClick={generateStatement}
          disabled={!isFormValid()}
          style={{
            padding: '12px 32px',
            backgroundColor: isFormValid() ? '#2563eb' : '#9ca3af',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            cursor: isFormValid() ? 'pointer' : 'not-allowed',
            fontSize: '14px',
            fontWeight: '600',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
          onMouseEnter={(e) => {
            if (isFormValid()) {
              e.target.style.backgroundColor = '#1d4ed8';
            }
          }}
          onMouseLeave={(e) => {
            if (isFormValid()) {
              e.target.style.backgroundColor = '#2563eb';
            }
          }}
        >
          <FileText className="w-4 h-4" />
          Generate Closing Statement
        </button>
      </div>
    </div>
  );

  const renderGenerating = () => (
    <div style={{ textAlign: 'center', padding: '48px 0' }}>
      <div style={{
        width: '64px',
        height: '64px',
        border: '4px solid #2563eb',
        borderTopColor: 'transparent',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        margin: '0 auto 24px'
      }} />
      <h3 style={{ 
        fontSize: '20px', 
        fontWeight: '600', 
        color: '#1f2937', 
        marginBottom: '16px' 
      }}>
        Generating Closing Statement
      </h3>
      <p style={{ 
        fontSize: '16px', 
        color: '#6b7280', 
        marginBottom: '16px' 
      }}>
        Creating your legal document and preparing PDF download...
      </p>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        gap: '8px' 
      }}>
        <div style={{
          width: '8px',
          height: '8px',
          backgroundColor: '#2563eb',
          borderRadius: '50%',
          animation: 'bounce 1.4s ease-in-out infinite both'
        }} />
        <div style={{
          width: '8px',
          height: '8px',
          backgroundColor: '#2563eb',
          borderRadius: '50%',
          animation: 'bounce 1.4s ease-in-out infinite both',
          animationDelay: '0.16s'
        }} />
        <div style={{
          width: '8px',
          height: '8px',
          backgroundColor: '#2563eb',
          borderRadius: '50%',
          animation: 'bounce 1.4s ease-in-out infinite both',
          animationDelay: '0.32s'
        }} />
      </div>
      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes bounce {
          0%, 80%, 100% { 
            transform: scale(0);
          } 40% { 
            transform: scale(1.0);
          }
        }
      `}</style>
    </div>
  );

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 50,
      padding: '16px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        maxWidth: '1024px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'hidden'
      }}>
        {/* Modal Header */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          padding: '24px', 
          borderBottom: '1px solid #e5e7eb' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Scale className="w-6 h-6" style={{ color: '#2563eb' }} />
            <div>
              <h2 style={{ 
                fontSize: '20px', 
                fontWeight: 'bold', 
                color: '#1f2937', 
                margin: 0 
              }}>
                Generate Closing Statement
              </h2>
              <p style={{ 
                fontSize: '14px', 
                color: '#6b7280', 
                margin: 0 
              }}>
                Create a formal closing statement using chat context
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '8px',
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = '#f3f4f6';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'transparent';
            }}
          >
            <X className="w-5 h-5" style={{ color: '#6b7280' }} />
          </button>
        </div>

        {/* Modal Content */}
        <div style={{ 
          padding: '24px', 
          overflowY: 'auto', 
          maxHeight: 'calc(90vh - 120px)' 
        }}>
          {isGenerating ? renderGenerating() : renderInputForm()}
        </div>
      </div>
    </div>
  );
}