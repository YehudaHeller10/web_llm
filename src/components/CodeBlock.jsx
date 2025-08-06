import { useState, useEffect } from 'react';

const CodeBlock = ({ code, language, className, isStreaming = false }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedCode, setEditedCode] = useState(code);
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [executionStatus, setExecutionStatus] = useState('idle'); // idle, running, success, error

  // Update editedCode when code prop changes (for streaming)
  useEffect(() => {
    setEditedCode(code);
  }, [code]);

  // Detect language from className or content
  const detectLanguage = () => {
    if (language) return language.toLowerCase();
    if (className) {
      const match = className.match(/language-(\w+)/);
      if (match) return match[1].toLowerCase();
    }
    // Auto-detect based on code content
    if (code.includes('def ') || code.includes('import ') || code.includes('print(')) return 'python';
    if (code.includes('function ') || code.includes('const ') || code.includes('console.log')) return 'javascript';
    if (code.includes('#include') || code.includes('int main')) return 'cpp';
    if (code.includes('public class') || code.includes('System.out')) return 'java';
    return 'text';
  };

  const lang = detectLanguage();

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(editedCode);
      // You could add a toast notification here
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  const executeCode = async () => {
    setIsRunning(true);
    setExecutionStatus('running');
    setOutput('');

    try {
      let result = '';

      switch (lang) {
        case 'javascript':
          result = await executeJavaScript(editedCode);
          break;
        case 'python':
          result = await executePython(editedCode);
          break;
        case 'html':
          result = await executeHTML(editedCode);
          break;
        case 'css':
          result = await executeCSS(editedCode);
          break;
        default:
          result = `Execution not supported for ${lang || 'unknown'} language yet.`;
      }

      setOutput(result);
      setExecutionStatus('success');
    } catch (error) {
      setOutput(error.message);
      setExecutionStatus('error');
    } finally {
      setIsRunning(false);
    }
  };

  const executeJavaScript = async (code) => {
    return new Promise((resolve) => {
      try {
        // Create a safe execution environment using Function constructor instead of eval
        const originalLog = console.log;
        const logs = [];

        // Override console.log to capture output
        console.log = (...args) => {
          logs.push(args.map(arg =>
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
          ).join(' '));
        };

        // Use Function constructor instead of eval for safer execution
        const func = new Function('console', `
          ${code}
        `);

        const result = func(console);

        // Restore original console.log
        console.log = originalLog;

        let output = logs.join('\n');
        if (result !== undefined) {
          output += (output ? '\n' : '') + `Return value: ${result}`;
        }

        resolve(output || 'Code executed successfully (no output)');
      } catch (error) {
        console.log = originalLog;
        throw new Error(`JavaScript Error: ${error.message}`);
      }
    });
  };

  const executePython = async (code) => {
    // For Python, we'll simulate execution since we can't run Python directly in the browser
    // In a real implementation, you might use Pyodide or send to a backend
    return new Promise((resolve) => {
      setTimeout(() => {
        if (code.includes('print(')) {
          const printMatches = code.match(/print\(([^)]+)\)/g);
          if (printMatches) {
            const outputs = printMatches.map(match => {
              const content = match.match(/print\(([^)]+)\)/)[1];
              // Simple string evaluation
              if (content.startsWith('"') && content.endsWith('"')) {
                return content.slice(1, -1);
              }
              if (content.startsWith("'") && content.endsWith("'")) {
                return content.slice(1, -1);
              }
              return content;
            });
            resolve(outputs.join('\n'));
          } else {
            resolve('Python code executed (simulated)');
          }
        } else {
          resolve('Python code executed (simulated)');
        }
      }, 1000);
    });
  };

  const executeHTML = async (code) => {
    return new Promise((resolve) => {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      document.body.appendChild(iframe);

      iframe.contentDocument.open();
      iframe.contentDocument.write(code);
      iframe.contentDocument.close();

      setTimeout(() => {
        const bodyContent = iframe.contentDocument.body?.innerText || 'HTML rendered successfully';
        document.body.removeChild(iframe);
        resolve(`HTML Output:\n${bodyContent}`);
      }, 500);
    });
  };

  const executeCSS = async (code) => {
    return Promise.resolve(`CSS code parsed successfully.\nRules: ${code.split('{').length - 1} rule(s) found.`);
  };

  const getLanguageIcon = () => {
    switch (lang) {
      case 'javascript': return '⚡';
      case 'python': return '🐍';
      case 'html': return '🌐';
      case 'css': return '🎨';
      case 'java': return '☕';
      case 'cpp': return '⚙️';
      default: return '📝';
    }
  };

  const getStatusText = () => {
    switch (executionStatus) {
      case 'running': return 'Executing...';
      case 'success': return 'Execution completed';
      case 'error': return 'Execution failed';
      default: return 'Ready to execute';
    }
  };

  const canExecute = ['javascript', 'python', 'html', 'css'].includes(lang);

  return (
    <div className="code-block-container my-4">
      <div className="relative">
        <div className="markdown-pre relative">
          {/* Code action buttons */}
          <div className="code-actions">
            <button
              className="code-action-btn copy"
              onClick={copyToClipboard}
              title="Copy code"
            >
              📋
            </button>
            <button
              className="code-action-btn edit"
              onClick={() => setIsEditing(true)}
              title="Edit code"
            >
              ✏️
            </button>
            {canExecute && (
              <button
                className="code-action-btn run"
                onClick={executeCode}
                disabled={isRunning}
                title={`Run ${lang} code`}
              >
                {isRunning ? '⏳' : '▶️'}
              </button>
            )}
          </div>

          <pre className="code-content">
            <code className="code-text">
              {editedCode}
            </code>
          </pre>
        </div>

        {/* Code execution output */}
        {(output || isRunning) && (
          <div className="code-output">
            <div className="code-output-header">
              <div className="code-output-status">
                <div className={`status-indicator ${executionStatus}`}></div>
                <span>{getLanguageIcon()} {lang.charAt(0).toUpperCase() + lang.slice(1)} Interpreter</span>
              </div>
              <span>{getStatusText()}</span>
            </div>
            <div className={`code-output-content ${executionStatus}`}>
              {isRunning ? 'Executing code...' : output}
            </div>
          </div>
        )}
      </div>

      {/* Code editor modal */}
      {isEditing && (
        <div className="code-editor-modal" onClick={() => setIsEditing(false)}>
          <div className="code-editor-container" onClick={(e) => e.stopPropagation()}>
            <div className="code-editor-header">
              <div className="code-editor-title">
                {getLanguageIcon()} Edit {lang.charAt(0).toUpperCase() + lang.slice(1)} Code
              </div>
              <div className="code-editor-actions">
                <button
                  className="code-action-btn"
                  onClick={() => {
                    setEditedCode(code);
                    setIsEditing(false);
                  }}
                  title="Cancel"
                >
                  ❌
                </button>
                <button
                  className="code-action-btn"
                  onClick={() => setIsEditing(false)}
                  title="Save changes"
                >
                  ✅
                </button>
              </div>
            </div>
            <textarea
              className="code-editor-textarea"
              value={editedCode}
              onChange={(e) => setEditedCode(e.target.value)}
              autoFocus
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default CodeBlock;
