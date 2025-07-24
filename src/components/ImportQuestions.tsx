import React, { useState } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, X } from 'lucide-react';
import { blink } from '../blink/client';

interface ImportQuestionsProps {
  onImportComplete: () => void;
  onClose: () => void;
}

interface ParsedQuestion {
  question: string;
  answers: string[];
  correctAnswer: number;
  group: string;
}

export default function ImportQuestions({ onImportComplete, onClose }: ImportQuestionsProps) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<ParsedQuestion[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const parseJSON = (content: string): ParsedQuestion[] => {
    const data = JSON.parse(content);
    if (!Array.isArray(data)) throw new Error('JSON must be an array');
    
    return data.map((item, index) => {
      if (!item.question || !item.answers || !Array.isArray(item.answers) || item.answers.length !== 4) {
        throw new Error(`Invalid question format at index ${index}`);
      }
      return {
        question: item.question,
        answers: item.answers,
        correctAnswer: item.correctAnswer || 0,
        group: item.group || 'Imported'
      };
    });
  };

  const parseCSV = (content: string): ParsedQuestion[] => {
    const lines = content.split('\n').filter(line => line.trim());
    const questions: ParsedQuestion[] = [];
    
    // Skip header if present
    const startIndex = lines[0].toLowerCase().includes('question') ? 1 : 0;
    
    for (let i = startIndex; i < lines.length; i++) {
      const parts = lines[i].split(',').map(part => part.trim().replace(/"/g, ''));
      if (parts.length < 6) continue;
      
      questions.push({
        question: parts[0],
        answers: [parts[1], parts[2], parts[3], parts[4]],
        correctAnswer: parseInt(parts[5]) || 0,
        group: parts[6] || 'Imported'
      });
    }
    
    return questions;
  };

  const parseTXT = (content: string): ParsedQuestion[] => {
    const sections = content.split(/\n\s*\n/).filter(section => section.trim());
    const questions: ParsedQuestion[] = [];
    
    for (const section of sections) {
      const lines = section.split('\n').map(line => line.trim()).filter(line => line);
      if (lines.length < 5) continue;
      
      const question = lines[0].replace(/^\d+\.\s*/, '');
      const answers = lines.slice(1, 5).map(answer => answer.replace(/^[A-D]\)\s*/, ''));
      const correctLine = lines.find(line => line.toLowerCase().includes('correct:'));
      const correctAnswer = correctLine ? parseInt(correctLine.match(/\d+/)?.[0] || '0') : 0;
      const groupLine = lines.find(line => line.toLowerCase().includes('group:'));
      const group = groupLine ? groupLine.split(':')[1].trim() : 'Imported';
      
      questions.push({
        question,
        answers,
        correctAnswer,
        group
      });
    }
    
    return questions;
  };

  const parseFile = (content: string, filename: string): ParsedQuestion[] => {
    const extension = filename.split('.').pop()?.toLowerCase();
    
    if (extension === 'json') {
      return parseJSON(content);
    } else if (extension === 'csv') {
      return parseCSV(content);
    } else if (extension === 'txt') {
      return parseTXT(content);
    } else {
      throw new Error('Unsupported file format');
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError('');
    setSuccess('');
    setPreview([]);

    try {
      const text = await selectedFile.text();
      const parsed = parseFile(text, selectedFile.name);
      setPreview(parsed);
    } catch (err) {
      setError('Failed to parse file. Please check the format.');
    }
  };

  const handleImport = async () => {
    if (!preview.length) return;
    
    setImporting(true);
    setError('');
    
    try {
      const user = await blink.auth.me();
      
      // Create groups first
      const uniqueGroups = [...new Set(preview.map(q => q.group))];
      const groupPromises = uniqueGroups.map(groupName =>
        blink.db.questionGroups.create({
          name: groupName,
          description: `Imported group: ${groupName}`,
          userId: user.id
        })
      );
      
      await Promise.all(groupPromises);
      
      // Get all groups to map names to IDs
      const allGroups = await blink.db.questionGroups.list({
        where: { userId: user.id }
      });
      
      // Import questions
      const questionPromises = preview.map(async (q) => {
        const group = allGroups.find(g => g.name === q.group);
        const question = await blink.db.questions.create({
          questionText: q.question,
          groupId: group?.id || null,
          userId: user.id
        });
        
        // Create answers
        const answerPromises = q.answers.map((answerText, index) =>
          blink.db.answers.create({
            questionId: question.id,
            answerText,
            isCorrect: index === q.correctAnswer,
            userId: user.id
          })
        );
        
        await Promise.all(answerPromises);
      });
      
      await Promise.all(questionPromises);
      
      setSuccess(`Successfully imported ${preview.length} questions!`);
      setTimeout(() => {
        onImportComplete();
        onClose();
      }, 2000);
      
    } catch (err) {
      setError('Failed to import questions. Please try again.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Import Questions</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* File Upload */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select File (JSON, CSV, or TXT)
          </label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <input
              type="file"
              accept=".json,.csv,.txt"
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer text-blue-600 hover:text-blue-500"
            >
              Choose file to upload
            </label>
            <p className="text-sm text-gray-500 mt-2">
              Supports JSON, CSV, and TXT formats
            </p>
          </div>
          {file && (
            <p className="mt-2 text-sm text-gray-600">
              <FileText className="w-4 h-4 inline mr-1" />
              {file.name}
            </p>
          )}
        </div>

        {/* Format Examples */}
        <div className="mb-6 bg-gray-50 rounded-lg p-4">
          <h3 className="font-medium text-gray-900 mb-2">Supported Formats:</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <h4 className="font-medium text-gray-700">JSON Format:</h4>
              <pre className="bg-white p-2 rounded border text-gray-600">
{`[{
  "question": "What is 2+2?",
  "answers": ["3", "4", "5", "6"],
  "correctAnswer": 1,
  "group": "Math"
}]`}
              </pre>
            </div>
            <div>
              <h4 className="font-medium text-gray-700">CSV Format:</h4>
              <pre className="bg-white p-2 rounded border text-gray-600">
{`Question,A,B,C,D,Correct,Group
"What is 2+2?","3","4","5","6",1,"Math"`}
              </pre>
            </div>
            <div>
              <h4 className="font-medium text-gray-700">TXT Format:</h4>
              <pre className="bg-white p-2 rounded border text-gray-600">
{`1. What is 2+2?
A) 3
B) 4
C) 5
D) 6
Correct: 1
Group: Math`}
              </pre>
            </div>
          </div>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
            <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center">
            <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
            <span className="text-green-700">{success}</span>
          </div>
        )}

        {/* Preview */}
        {preview.length > 0 && (
          <div className="mb-6">
            <h3 className="font-medium text-gray-900 mb-3">
              Preview ({preview.length} questions)
            </h3>
            <div className="max-h-60 overflow-y-auto border rounded-lg">
              {preview.slice(0, 5).map((q, index) => (
                <div key={index} className="p-4 border-b last:border-b-0">
                  <div className="font-medium text-gray-900 mb-2">{q.question}</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {q.answers.map((answer, i) => (
                      <div
                        key={i}
                        className={`p-2 rounded ${
                          i === q.correctAnswer
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {String.fromCharCode(65 + i)}) {answer}
                      </div>
                    ))}
                  </div>
                  <div className="text-xs text-gray-500 mt-2">Group: {q.group}</div>
                </div>
              ))}
              {preview.length > 5 && (
                <div className="p-4 text-center text-gray-500">
                  ... and {preview.length - 5} more questions
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end space-x-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!preview.length || importing}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {importing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Importing...
              </>
            ) : (
              `Import ${preview.length} Questions`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}